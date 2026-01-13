#!/usr/bin/env python3
"""
Generate E3_theme_map_v5.csv from e3_solution_themes_v5.csv data.

Themes are ordered by the number of solutions (descending).
Subthemes are ordered by: a) the theme they are associated with, and b) within that theme, the order they appear.
"""

import argparse
import csv
import io
from collections import defaultdict, OrderedDict

current_version = 5

parser = argparse.ArgumentParser(description="Generate theme map from solutions data.")
parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose output")
parser.add_argument("input_file", nargs="?", default="e3_solution_themes_v5.csv", help="Input solutions CSV file")
parser.add_argument("output_file", nargs="?", default=f"E3_theme_map_v{current_version}.csv", help="Output theme map CSV file")
parser.add_argument("--old_theme_map", default="E3_theme_map_v2.csv", help="Old theme map file to extract descriptions from (optional)")
args = parser.parse_args()

if args.verbose:
    print(f"Reading solutions from: {args.input_file}")
    print(f"Outputting theme map to: {args.output_file}")

# Try to detect encoding
encodings_to_try = ["cp1252", "utf-8-sig", "latin-1", "utf-8"]
solutions_encoding = None
solutions_content = None

for encoding in encodings_to_try:
    try:
        with open(args.input_file, "r", encoding=encoding) as f:
            solutions_content = f.read()
        if "‚Äô" in solutions_content or "â€™" in solutions_content:
            if args.verbose:
                print(f"Found mojibake characters with {encoding}, trying next encoding...")
            continue
        solutions_encoding = encoding
        if args.verbose:
            print(f"Successfully read solutions CSV with encoding: {encoding}")
        break
    except (UnicodeDecodeError, UnicodeError, FileNotFoundError):
        if args.verbose:
            print(f"Failed to read with {encoding}, trying next encoding...")
        continue

if solutions_encoding is None:
    solutions_encoding = "utf-8-sig"
    if args.verbose:
        print(f"Using fallback encoding: {solutions_encoding}")
    with open(args.input_file, "r", encoding=solutions_encoding) as f:
        solutions_content = f.read()

# Load old theme map descriptions if available
description_map = {}  # Maps (theme, subtheme) tuple to description
try:
    old_encodings_to_try = ["cp1252", "utf-8-sig", "latin-1", "utf-8"]
    old_theme_map_content = None
    old_encoding = None
    
    for encoding in old_encodings_to_try:
        try:
            with open(args.old_theme_map, "r", encoding=encoding) as f:
                old_theme_map_content = f.read()
            if "‚Äô" in old_theme_map_content or "â€™" in old_theme_map_content:
                continue
            old_encoding = encoding
            break
        except (UnicodeDecodeError, UnicodeError, FileNotFoundError):
            continue
    
    if old_encoding is None:
        old_encoding = "utf-8-sig"
        with open(args.old_theme_map, "r", encoding=old_encoding) as f:
            old_theme_map_content = f.read()
    
    with io.StringIO(old_theme_map_content) as f:
        reader = csv.DictReader(f)
        for row in reader:
            theme = row["Main_theme"].strip()
            subtheme = row["Subtheme"].strip()
            description = row["Subtheme_Description"].strip()
            description_map[(theme, subtheme)] = description
    
    if args.verbose:
        print(f"Loaded {len(description_map)} descriptions from old theme map")
except Exception as e:
    if args.verbose:
        print(f"Warning: Could not load old theme map for descriptions: {e}")

# Parse solutions CSV
theme_solution_counts = defaultdict(set)  # Maps theme to set of solution IDs
theme_subtheme_order = OrderedDict()  # Maps (theme, subtheme) to first appearance order
subthemes_by_theme = defaultdict(OrderedDict)  # Maps theme to OrderedDict of subthemes

with io.StringIO(solutions_content) as f:
    reader = csv.DictReader(f)
    appearance_order = 0
    
    for row in reader:
        solution_id = row["SOLUTION_ID"].strip()
        solution_main_theme = row.get("SOLUTION_MAIN_THEME", "").strip()
        solution_subtheme = row.get("SOLUTION_SUBTHEME", "").strip()
        
        if not solution_main_theme or not solution_subtheme:
            continue
        
        # Count unique solutions per theme
        theme_solution_counts[solution_main_theme].add(solution_id)
        
        # Track subtheme order within theme
        if solution_main_theme not in subthemes_by_theme:
            subthemes_by_theme[solution_main_theme] = OrderedDict()
        
        if solution_subtheme not in subthemes_by_theme[solution_main_theme]:
            subthemes_by_theme[solution_main_theme][solution_subtheme] = appearance_order
            appearance_order += 1

if args.verbose:
    print(f"Found {len(theme_solution_counts)} themes")
    print(f"Found {sum(len(subthemes) for subthemes in subthemes_by_theme.values())} unique subthemes")

# Sort themes by solution count (descending), then alphabetically for tie-breaking
sorted_themes = sorted(
    theme_solution_counts.keys(),
    key=lambda theme: (-len(theme_solution_counts[theme]), theme)
)

if args.verbose:
    print("\nThemes ordered by solution count:")
    for theme in sorted_themes:
        count = len(theme_solution_counts[theme])
        print(f"  {theme}: {count} solutions")

# Build output rows
output_rows = []
main_theme_id = 1
subtheme_id = 1

for theme in sorted_themes:
    # Get subthemes for this theme, ordered by appearance
    subthemes = list(subthemes_by_theme[theme].keys())
    
    # Sort subthemes by their appearance order within the theme
    subthemes_sorted = sorted(
        subthemes,
        key=lambda st: subthemes_by_theme[theme][st]
    )
    
    for subtheme in subthemes_sorted:
        # Try to get description from old theme map
        description = description_map.get((theme, subtheme), "")
        
        output_rows.append({
            "Main_theme": theme,
            "Subtheme": subtheme,
            "Subtheme_Description": description,
            "Main_Theme_ID": main_theme_id,
            "Subtheme_ID": subtheme_id
        })
        subtheme_id += 1
    
    main_theme_id += 1

# Write output CSV
with open(args.output_file, "w", encoding="utf-8", newline="") as f:
    fieldnames = ["Main_theme", "Subtheme", "Subtheme_Description", "Main_Theme_ID", "Subtheme_ID"]
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(output_rows)

if args.verbose:
    print(f"\nGenerated {len(output_rows)} theme/subtheme mappings")
    print(f"Output written to: {args.output_file}")
