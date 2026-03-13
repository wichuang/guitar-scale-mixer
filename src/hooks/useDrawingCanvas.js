import { useState, useRef, useCallback, useEffect } from 'react';

export const HIGHLIGHTER_COLORS = [
  { name: 'Yellow', value: 'rgba(255, 235, 59, 0.4)', display: '#ffeb3b' },
  { name: 'Green',  value: 'rgba(76, 175, 80, 0.4)',  display: '#4caf50' },
  { name: 'Blue',   value: 'rgba(66, 165, 245, 0.4)', display: '#42a5f5' },
  { name: 'Pink',   value: 'rgba(236, 64, 122, 0.4)', display: '#ec407a' },
  { name: 'Orange', value: 'rgba(255, 167, 38, 0.4)', display: '#ffa726' },
  { name: 'Red',    value: 'rgba(229, 57, 53, 0.4)',   display: '#e53935' },
];

const LINE_WIDTH = 18;

function getPointerPos(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  return { x, y };
}

function drawStroke(ctx, stroke) {
  const { color, lineWidth, points } = stroke;
  if (points.length < 2) return;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'source-over';

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
  }

  // Last segment
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function redrawAll(canvas, history) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const stroke of history) {
    drawStroke(ctx, stroke);
  }
}

export function useDrawingCanvas(canvasRef, containerRef) {
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [currentColor, setCurrentColor] = useState(HIGHLIGHTER_COLORS[0].value);
  const [strokeHistory, setStrokeHistory] = useState([]);

  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef(null);
  const strokeHistoryRef = useRef(strokeHistory);

  // Keep ref in sync
  useEffect(() => {
    strokeHistoryRef.current = strokeHistory;
  }, [strokeHistory]);

  // Resize canvas to match container
  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    redrawAll(canvas, strokeHistoryRef.current);
  }, [canvasRef, containerRef]);

  // ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(syncCanvasSize);
    observer.observe(container);
    syncCanvasSize();

    return () => observer.disconnect();
  }, [containerRef, syncCanvasSize]);

  const startStroke = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawingRef.current = true;
    const pos = getPointerPos(canvas, e);
    currentStrokeRef.current = {
      color: currentColor,
      lineWidth: LINE_WIDTH * (window.devicePixelRatio || 1),
      points: [pos],
    };
  }, [canvasRef, currentColor]);

  const continueStroke = useCallback((e) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas || !currentStrokeRef.current) return;

    const pos = getPointerPos(canvas, e);
    currentStrokeRef.current.points.push(pos);

    // Live draw
    const ctx = canvas.getContext('2d');
    redrawAll(canvas, strokeHistoryRef.current);
    drawStroke(ctx, currentStrokeRef.current);
  }, [canvasRef]);

  const endStroke = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (currentStrokeRef.current && currentStrokeRef.current.points.length >= 2) {
      setStrokeHistory(prev => [...prev, currentStrokeRef.current]);
    }
    currentStrokeRef.current = null;
  }, []);

  const undo = useCallback(() => {
    setStrokeHistory(prev => {
      const next = prev.slice(0, -1);
      const canvas = canvasRef.current;
      if (canvas) redrawAll(canvas, next);
      return next;
    });
  }, [canvasRef]);

  const clearAll = useCallback(() => {
    setStrokeHistory([]);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [canvasRef]);

  const toggleDrawing = useCallback(() => {
    setDrawingEnabled(prev => !prev);
  }, []);

  return {
    drawingEnabled,
    currentColor,
    setCurrentColor,
    strokeHistory,
    toggleDrawing,
    startStroke,
    continueStroke,
    endStroke,
    undo,
    clearAll,
  };
}
