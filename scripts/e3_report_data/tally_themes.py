#!/usr/bin/env python3
"""
Count unique solutions per theme from e3_solution_themes_v5.csv.

Outputs theme title and number of unique solutions to stdout.
"""

import argparse
import csv
import io
from collections import defaultdict

parser = argparse.ArgumentParser(description="Count unique solutions per theme.")
parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose output")
parser.add_argument("input_file", nargs="?", default="e3_solution_themes_v5.csv", help="Input solutions CSV file")
args = parser.parse_args()

if args.verbose:
    print(f"Reading solutions from: {args.input_file}")

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

# Count unique solutions per theme
theme_solution_counts = defaultdict(set)  # Maps theme to set of solution IDs

with io.StringIO(solutions_content) as f:
    reader = csv.DictReader(f)
    
    for row in reader:
        solution_id = row["SOLUTION_ID"].strip()
        solution_main_theme = row.get("SOLUTION_MAIN_THEME", "").strip()
        
        if not solution_main_theme or not solution_id:
            continue
        
        # Add solution ID to the set for this theme
        theme_solution_counts[solution_main_theme].add(solution_id)

# Sort themes by solution count (descending), then alphabetically for tie-breaking
sorted_themes = sorted(
    theme_solution_counts.keys(),
    key=lambda theme: (-len(theme_solution_counts[theme]), theme)
)

# Output results to stdout
for theme in sorted_themes:
    count = len(theme_solution_counts[theme])
    print(f"{theme},{count}")

if args.verbose:
    print(f"\nTotal themes: {len(sorted_themes)}", file=__import__('sys').stderr)
