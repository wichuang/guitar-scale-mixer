#!/usr/bin/env python3
"""
Generate a test guitar score image with both a 5-line staff and a 6-line tab below it.
Output: test-files/ocr-samples/test-staff-tab.png
"""

from PIL import Image, ImageDraw, ImageFont
import os

# --- Configuration ---
WIDTH, HEIGHT = 1000, 350
BG_COLOR = (255, 255, 255)  # pure white
FG_COLOR = (0, 0, 0)        # pure black

# Staff geometry
STAFF_X_START = 60
STAFF_X_END = 940
STAFF_Y_TOP = 60
STAFF_LINE_SPACING = 15  # 5 lines: y=60,75,90,105,120
STAFF_LINE_COUNT = 5

# Tab geometry
TAB_Y_TOP = 150
TAB_LINE_SPACING = 20  # 6 lines: y=150,170,190,210,230,250
TAB_LINE_COUNT = 6

# Fret numbers pattern (strings top-to-bottom: e B G D A E)
FRET_PATTERN = [
    [0, 1, 3, 0, 1, 3, 5, 0],  # e (high E)
    [1, 0, 0, 1, 0, 0, 5, 1],  # B
    [0, 0, 0, 0, 0, 0, 4, 0],  # G
    [2, 2, 0, 2, 2, 0, 5, 2],  # D
    [3, 3, 2, 3, 3, 2, 3, 3],  # A
    [0, 0, 3, 0, 0, 3, 0, 0],  # E (low E)
]

NUM_COLUMNS = 8

# --- Create image ---
img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
draw = ImageDraw.Draw(img)

# --- Load fonts ---
font_candidates = [
    "/System/Library/Fonts/Helvetica.ttc",
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/Library/Fonts/Arial.ttf",
    "/System/Library/Fonts/SFNSMono.ttf",
]

def load_font(size):
    for path in font_candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()

font_header = load_font(20)
font_key = load_font(14)
font_clef = load_font(36)
font_tab_label = load_font(14)
font_fret = load_font(16)
font_fret_bold = load_font(17)

# --- Header ---
# "Key: Am" on the left
draw.text((STAFF_X_START, 12), "Key: Am", fill=FG_COLOR, font=font_key)

# "Test Song" centered
title = "Test Song"
title_bbox = draw.textbbox((0, 0), title, font=font_header)
title_w = title_bbox[2] - title_bbox[0]
draw.text(((WIDTH - title_w) // 2, 10), title, fill=FG_COLOR, font=font_header)

# "4/4" on the right
ts = "4/4"
ts_bbox = draw.textbbox((0, 0), ts, font=font_key)
ts_w = ts_bbox[2] - ts_bbox[0]
draw.text((STAFF_X_END - ts_w, 12), ts, fill=FG_COLOR, font=font_key)

# --- Draw 5-line staff ---
staff_line_ys = [STAFF_Y_TOP + i * STAFF_LINE_SPACING for i in range(STAFF_LINE_COUNT)]

for y in staff_line_ys:
    draw.line([(STAFF_X_START, y), (STAFF_X_END, y)], fill=FG_COLOR, width=2)

# Treble clef - draw a stylized "G" clef symbol
clef_x = STAFF_X_START + 8
clef_y_center = (staff_line_ys[0] + staff_line_ys[-1]) // 2
draw.text((clef_x - 4, staff_line_ys[1] - 18), "G", fill=FG_COLOR, font=font_clef)

# --- Draw note heads on staff ---
col_spacing = (STAFF_X_END - STAFF_X_START - 80) / (NUM_COLUMNS - 1)
col_x_start = STAFF_X_START + 80

e_frets = FRET_PATTERN[0]  # [0, 1, 3, 0, 1, 3, 5, 0]

def fret_to_staff_y(fret):
    base_y = staff_line_ys[4]  # bottom line
    return base_y - fret * (STAFF_LINE_SPACING / 2.0)

note_oval_rx = 7
note_oval_ry = 5

for col_idx in range(NUM_COLUMNS):
    cx = col_x_start + col_idx * col_spacing
    fret = e_frets[col_idx]
    cy = fret_to_staff_y(fret)

    # Draw filled oval (note head)
    draw.ellipse(
        [cx - note_oval_rx, cy - note_oval_ry, cx + note_oval_rx, cy + note_oval_ry],
        fill=FG_COLOR,
    )

    # Draw a stem
    stem_top = cy - 35
    draw.line([(cx + note_oval_rx - 1, cy), (cx + note_oval_rx - 1, stem_top)], fill=FG_COLOR, width=2)

# --- Draw 6-line tab ---
tab_line_ys = [TAB_Y_TOP + i * TAB_LINE_SPACING for i in range(TAB_LINE_COUNT)]

for y in tab_line_ys:
    draw.line([(STAFF_X_START, y), (STAFF_X_END, y)], fill=FG_COLOR, width=2)

# "TAB" label at the left, vertically arranged
tab_label_x = STAFF_X_START + 6
tab_label_letters = ["T", "A", "B"]
for i, letter in enumerate(tab_label_letters):
    ly = tab_line_ys[0] + 8 + i * 28
    letter_bbox = draw.textbbox((0, 0), letter, font=font_tab_label)
    lw = letter_bbox[2] - letter_bbox[0]
    draw.text((tab_label_x + (12 - lw) // 2, ly), letter, fill=FG_COLOR, font=font_tab_label)

# --- Draw fret numbers on tab ---
for col_idx in range(NUM_COLUMNS):
    cx = col_x_start + col_idx * col_spacing

    for string_idx in range(TAB_LINE_COUNT):
        fret_num = FRET_PATTERN[string_idx][col_idx]
        fret_str = str(fret_num)
        line_y = tab_line_ys[string_idx]

        # Measure text size
        bbox = draw.textbbox((0, 0), fret_str, font=font_fret_bold)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]

        text_x = cx - tw / 2
        text_y = line_y - th / 2 - 2

        # Draw white rectangle behind the number to clear the line
        pad_x = 4
        pad_y = 2
        draw.rectangle(
            [text_x - pad_x, line_y - th / 2 - pad_y, text_x + tw + pad_x, line_y + th / 2 + pad_y],
            fill=BG_COLOR,
        )

        # Draw the fret number
        draw.text((text_x, text_y), fret_str, fill=FG_COLOR, font=font_fret_bold)

# --- Vertical barlines at start and end ---
# Left barline: from top of staff to bottom of tab
draw.line(
    [(STAFF_X_START, staff_line_ys[0]), (STAFF_X_START, tab_line_ys[-1])],
    fill=FG_COLOR,
    width=3,
)

# Right barline: double barline for ending
draw.line(
    [(STAFF_X_END, staff_line_ys[0]), (STAFF_X_END, tab_line_ys[-1])],
    fill=FG_COLOR,
    width=3,
)
draw.line(
    [(STAFF_X_END - 6, staff_line_ys[0]), (STAFF_X_END - 6, tab_line_ys[-1])],
    fill=FG_COLOR,
    width=1,
)

# --- Save ---
output_dir = os.path.dirname(os.path.abspath(__file__))
output_path = os.path.join(output_dir, "ocr-samples", "test-staff-tab.png")
os.makedirs(os.path.dirname(output_path), exist_ok=True)
img.save(output_path, "PNG")
print(f"Saved test image to: {output_path}")
print(f"Image size: {img.size}")
