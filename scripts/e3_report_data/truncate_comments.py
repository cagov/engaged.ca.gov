# truncate_comments.py
# Copies a CSV file while omitting COMMENT_MAIN_THEMES and COMMENT_SUBTHEMES columns

import argparse
import csv

parser = argparse.ArgumentParser(description="Copy CSV file while omitting COMMENT_MAIN_THEMES and COMMENT_SUBTHEMES columns.")
parser.add_argument("input_file", nargs="?", default="E3_data_v4.csv", help="Input CSV file (default: E3_data_v4.csv)")
parser.add_argument("output_file", nargs="?", default="E3_data_v4_new.csv", help="Output CSV file (default: E3_data_v4_new.csv)")
args = parser.parse_args()

# Columns to omit
columns_to_omit = {"COMMENT_MAIN_THEMES", "COMMENT_SUBTHEMES"}

# Read input CSV and write output CSV
with open(args.input_file, "r", encoding="utf-8") as infile, \
     open(args.output_file, "w", encoding="utf-8", newline="") as outfile:
    
    reader = csv.DictReader(infile)
    
    # Get all fieldnames except the ones to omit
    fieldnames = [field for field in reader.fieldnames if field not in columns_to_omit]
    
    writer = csv.DictWriter(outfile, fieldnames=fieldnames)
    writer.writeheader()
    
    # Write rows with omitted columns excluded
    for row in reader:
        filtered_row = {key: value for key, value in row.items() if key not in columns_to_omit}
        writer.writerow(filtered_row)

print(f"Successfully copied {args.input_file} to {args.output_file}")
print(f"Omitted columns: {', '.join(sorted(columns_to_omit))}")
