#!/usr/bin/env python3
"""
Analyze test-staff-tab.png row by row to understand line detection characteristics.

For each row (y=0 to height), calculate:
  1. Total black pixels (value < 128) as ratio of width
  2. Maximum consecutive black pixels as ratio of width

Print rows where totalRatio > 0.1 or consecutiveRatio > 0.1, grouped by nearby y-values.
Also print overall image stats.
"""

from PIL import Image
import os

IMAGE_PATH = "/Users/williamchuang/guitar-scale-mixer/test-files/ocr-samples/test-staff-tab.png"

def analyze_row(pixels, y, width):
    """Return (totalRatio, consecutiveRatio) for a given row."""
    black_count = 0
    max_consecutive = 0
    current_consecutive = 0

    for x in range(width):
        val = pixels[x, y]
        if isinstance(val, tuple):
            brightness = int(0.299 * val[0] + 0.587 * val[1] + 0.114 * val[2])
        else:
            brightness = val

        if brightness < 128:
            black_count += 1
            current_consecutive += 1
            if current_consecutive > max_consecutive:
                max_consecutive = current_consecutive
        else:
            current_consecutive = 0

    total_ratio = black_count / width
    consecutive_ratio = max_consecutive / width
    return total_ratio, consecutive_ratio


def main():
    if not os.path.exists(IMAGE_PATH):
        print(f"ERROR: Image not found at {IMAGE_PATH}")
        return

    img = Image.open(IMAGE_PATH)
    width, height = img.size
    mode = img.mode
    pixels = img.load()

    # --- Overall image stats ---
    print("=" * 70)
    print("IMAGE STATS")
    print("=" * 70)
    print(f"  Path:       {IMAGE_PATH}")
    print(f"  Dimensions: {width} x {height}")
    print(f"  Mode:       {mode}")

    # Compute mean brightness
    total_brightness = 0
    total_pixels = width * height
    for y in range(height):
        for x in range(width):
            val = pixels[x, y]
            if isinstance(val, tuple):
                brightness = int(0.299 * val[0] + 0.587 * val[1] + 0.114 * val[2])
            else:
                brightness = val
            total_brightness += brightness

    mean_brightness = total_brightness / total_pixels
    print(f"  Mean brightness: {mean_brightness:.1f} / 255")
    print()

    # --- Row-by-row analysis ---
    THRESHOLD = 0.1
    results = []

    for y in range(height):
        total_ratio, consecutive_ratio = analyze_row(pixels, y, width)
        if total_ratio > THRESHOLD or consecutive_ratio > THRESHOLD:
            results.append((y, total_ratio, consecutive_ratio))

    # --- Group nearby y-values ---
    GAP_THRESHOLD = 5
    groups = []
    current_group = []

    for entry in results:
        if current_group and entry[0] - current_group[-1][0] > GAP_THRESHOLD:
            groups.append(current_group)
            current_group = [entry]
        else:
            current_group.append(entry)
    if current_group:
        groups.append(current_group)

    # --- Print results ---
    print("=" * 70)
    print(f"ROWS WITH totalRatio > {THRESHOLD} OR consecutiveRatio > {THRESHOLD}")
    print(f"  (grouped by proximity, gap > {GAP_THRESHOLD} rows = new group)")
    print("=" * 70)
    print()

    if not results:
        print("  No rows exceed the threshold. The image may be mostly white/bright.")
        print()
        print("  DEBUG: Printing ALL rows with any black pixels:")
        for y in range(height):
            tr, cr = analyze_row(pixels, y, width)
            if tr > 0.01:
                print(f"    y={y:4d}  totalRatio={tr:.4f}  consecutiveRatio={cr:.4f}")
        return

    for gi, group in enumerate(groups):
        y_min = group[0][0]
        y_max = group[-1][0]
        y_center = (y_min + y_max) / 2

        best = max(group, key=lambda e: e[1])

        print(f"  GROUP {gi + 1}: y = {y_min}..{y_max}  (center ~ {y_center:.0f}, span = {y_max - y_min + 1} rows)")
        print(f"    Peak total ratio: {best[1]:.4f} at y={best[0]}")
        print(f"    Peak consec ratio: {max(e[2] for e in group):.4f}")
        print(f"    {'y':>6s}  {'totalRatio':>12s}  {'consecutiveRatio':>18s}  {'bar':s}")
        print(f"    {'---':>6s}  {'----------':>12s}  {'----------------':>18s}  {'---':s}")

        for y_val, tr, cr in group:
            bar_total = "#" * int(tr * 50)
            bar_consec = "*" * int(cr * 50)
            print(f"    {y_val:6d}  {tr:12.4f}  {cr:18.4f}  {bar_total} | {bar_consec}")

        print()

    # --- Summary table ---
    print("=" * 70)
    print("SUMMARY: Group centers (potential line positions)")
    print("=" * 70)
    print(f"  {'Group':>5s}  {'Y range':>12s}  {'Center':>8s}  {'Peak totalR':>12s}  {'Peak consecR':>13s}")
    print(f"  {'-----':>5s}  {'-------':>12s}  {'------':>8s}  {'-----------':>12s}  {'------------':>13s}")

    for gi, group in enumerate(groups):
        y_min = group[0][0]
        y_max = group[-1][0]
        y_center = (y_min + y_max) / 2
        peak_total = max(e[1] for e in group)
        peak_consec = max(e[2] for e in group)
        print(f"  {gi+1:5d}  {y_min:4d}..{y_max:<4d}   {y_center:8.1f}  {peak_total:12.4f}  {peak_consec:13.4f}")

    print()

    # --- Expected vs actual ---
    print("=" * 70)
    print("EXPECTED LINE POSITIONS vs DETECTED GROUPS")
    print("=" * 70)
    expected_staff = [60, 75, 90, 105, 120]
    expected_tab = [150, 170, 190, 210, 230, 250]

    print(f"\n  Expected staff lines: {expected_staff}")
    print(f"  Expected tab lines:   {expected_tab}")
    print()

    group_centers = [(gi, (g[0][0] + g[-1][0]) / 2) for gi, g in enumerate(groups)]
    for label, expected_list in [("Staff", expected_staff), ("Tab", expected_tab)]:
        for ey in expected_list:
            closest = min(group_centers, key=lambda gc: abs(gc[1] - ey)) if group_centers else None
            if closest and abs(closest[1] - ey) < 15:
                print(f"  {label} line y={ey:3d} -> Group {closest[0]+1} (center={closest[1]:.0f}, offset={closest[1]-ey:+.0f})")
            else:
                print(f"  {label} line y={ey:3d} -> NO MATCH")

    print()


if __name__ == "__main__":
    main()
