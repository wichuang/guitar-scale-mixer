# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Guitar Scale Mixer is a React web application for guitar scale learning and practice. It provides an interactive fretboard visualization, real-time pitch detection via microphone, and support for multiple notation formats (tabs, staff, jianpu).

## Development Commands

```bash
# Install dependencies (Bun preferred, npm works too)
bun install

# Start development server (localhost:5173)
bun run dev

# Production build (outputs to dist/)
bun run build

# Run ESLint
bun run lint

# Preview production build locally
bun run preview

# Deploy (builds and deploys)
./deploy.sh
```

## Architecture

### Application Modes
The app has three main modes controlled in `src/App.jsx`:
- **Scale Mode** - Interactive fretboard showing scale patterns with multi-scale overlay (up to 3 scales)
- **Live Mode** - Real-time pitch detection from microphone input (`src/components/LiveMode.jsx`)
- **Read Mode** - Sheet music/tab reader with playback (`src/components/ReadMode/`)

### Key Directories

**`src/hooks/`** - Business logic as React hooks:
- `useAudio.js` - Guitar sound playback via soundfont-player
- `usePitchDetection.js` - Microphone pitch detection via pitchfinder
- `usePlayback.js` - Score/tab playback engine
- `useMetronome.js`, `useLoopSection.js`, `useSpeedTrainer.js` - Practice tools

**`src/parsers/`** - Notation format parsers:
- `TabParser.js` - Guitar tablature
- `StaffParser.js` - Standard notation
- `JianpuParser.js` - Numbered musical notation (簡譜)

**`src/ocr/`** - Image recognition for importing sheet music:
- `TabOCR.js`, `StaffOCR.js` - OCR processing using Tesseract.js
- `imagePreprocess.js`, `staffPreprocess.js` - Image preprocessing
- `noteDetection.js` - Note detection from staff images

**`src/data/scaleData.js`** - Music theory constants including all scale definitions (22 scales), intervals, and note colors

**`src/converters/NoteConverter.js`** - Converts between notation formats (tab ↔ staff ↔ jianpu)

### External Services
- **Supabase** (`src/lib/supabase.js`) - Authentication and cloud preset storage
- Environment variables in `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### Audio Libraries
- **Tone.js** - Audio synthesis and scheduling
- **soundfont-player** - Guitar sound samples (7 different guitar tones)
- **pitchfinder** - Real-time pitch detection algorithms

## Code Conventions

- React 19 with functional components and hooks
- Vite 7 for build tooling
- CSS modules co-located with components (e.g., `Fretboard.jsx` + `Fretboard.css`)
- ESLint with react-hooks and react-refresh plugins
- Base URL configured for GitHub Pages deployment (`/guitar-scale-mixer/`)
