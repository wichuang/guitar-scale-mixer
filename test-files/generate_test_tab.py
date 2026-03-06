#!/usr/bin/env python3
"""
Generate a clean test guitar tab image for OCR testing.

Produces a standard 6-line guitar tab staff with fret numbers placed
at regular intervals on the lines. Output is an 800x200 white-background
PNG with black lines and text.
"""

from PIL import Image, ImageDraw, ImageFont
import os

# --- Configuration ---
WIDTH = 800
HEIGHT = 200
BG_COLOR = "white"
LINE_COLOR = "black"
TEXT_COLOR = "black"
LINE_SPACING = 20  # vertical distance between tab lines
FONT_SIZE = 15

# Tab data: each row is one string, top to bottom (e  B  G  D  A  E)
TAB_DATA = [
    [0, 1, 3, 0, 1, 3, 5],  # e (high E)
    [1, 0, 0, 1, 0, 0, 5],  # B
    [0, 0, 0, 0, 0, 0, 4],  # G
    [2, 2, 0, 2, 2, 0, 5],  # D
    [3, 3, 2, 3, 3, 2, 3],  # A
    [0, 0, 3, 0, 0, 3, 0],  # E (low E)
]

STRING_LABELS = ["e", "B", "G", "D", "A", "E"]

NUM_STRINGS = len(TAB_DATA)
NUM_NOTES = len(TAB_DATA[0])

# --- Derived layout ---
# Center the 6 lines vertically in the image
total_staff_height = (NUM_STRINGS - 1) * LINE_SPACING
top_y = (HEIGHT - total_staff_height) // 2

# Horizontal margins
LEFT_MARGIN = 60   # room for string labels
RIGHT_MARGIN = 40
STAFF_LEFT = LEFT_MARGIN
STAFF_RIGHT = WIDTH - RIGHT_MARGIN

# Evenly space the note columns across the staff width
note_area_left = STAFF_LEFT + 30   # small gap after the label area
note_area_right = STAFF_RIGHT - 20  # small gap before the end bar
note_spacing = (note_area_right - note_area_left) / (NUM_NOTES - 1) if NUM_NOTES > 1 else 0


def find_font(size):
    """Try to load a clean sans-serif font; fall back to default."""
    candidates = [
        # macOS
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSMono.ttf",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        # Linux
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for path in candidates:
        if os.path.isfile(path):
            return ImageFont.truetype(path, size)
    # Ultimate fallback
    return ImageFont.load_default()


def main():
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)
    font = find_font(FONT_SIZE)
    label_font = find_font(FONT_SIZE)

    # --- Draw string labels on the left ---
    for i, label in enumerate(STRING_LABELS):
        y = top_y + i * LINE_SPACING
        bbox = draw.textbbox((0, 0), label, font=label_font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        label_x = STAFF_LEFT - tw - 8
        label_y = y - th // 2
        draw.text((label_x, label_y), label, fill=TEXT_COLOR, font=label_font)

    # --- Draw the 6 horizontal staff lines ---
    for i in range(NUM_STRINGS):
        y = top_y + i * LINE_SPACING
        draw.line([(STAFF_LEFT, y), (STAFF_RIGHT, y)], fill=LINE_COLOR, width=1)

    # --- Draw vertical bar lines at start and end ---
    y_top = top_y
    y_bot = top_y + (NUM_STRINGS - 1) * LINE_SPACING
    draw.line([(STAFF_LEFT, y_top), (STAFF_LEFT, y_bot)], fill=LINE_COLOR, width=2)
    draw.line([(STAFF_RIGHT, y_top), (STAFF_RIGHT, y_bot)], fill=LINE_COLOR, width=2)

    # --- Place fret numbers on the lines ---
    for col in range(NUM_NOTES):
        x_center = note_area_left + col * note_spacing
        for row in range(NUM_STRINGS):
            fret = TAB_DATA[row][col]
            fret_str = str(fret)
            y_line = top_y + row * LINE_SPACING

            # Measure the text so we can center it on the line
            bbox = draw.textbbox((0, 0), fret_str, font=font)
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]
            # y offset: the bbox top may not be 0, compensate
            ty_offset = bbox[1]

            tx = x_center - tw / 2
            ty = y_line - th / 2 - ty_offset

            # Erase a small rectangle behind the number so the line
            # does not bleed through the digit
            pad_x = 3
            pad_y = 1
            draw.rectangle(
                [
                    (tx - pad_x, y_line - th / 2 - pad_y),
                    (tx + tw + pad_x, y_line + th / 2 + pad_y),
                ],
                fill=BG_COLOR,
            )

            draw.text((tx, ty), fret_str, fill=TEXT_COLOR, font=font)

    # --- Save ---
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ocr-samples")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "test-tab-simple.png")
    img.save(out_path)
    print(f"Saved test tab image to: {out_path}")
    print(f"  Size: {img.size[0]}x{img.size[1]}")


if __name__ == "__main__":
    main()
