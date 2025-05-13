#!/usr/bin/env python3
"""
CSV to JSON Converter

This script converts CSV files to JSON format, preserving the structure and data types.
Designed to work with engca_comment_scatterplot_source.csv and similar files.

Usage:
    python convert_csv_to_json.py input.csv output.json
    
If no output file is specified, the script will use the same name as the input file with .json extension.
"""

import csv
import json
import sys
import os
from typing import List, Dict, Any, Union


def csv_to_json(csv_file_path: str, json_file_path: str = None) -> None:
    """
    Convert a CSV file to JSON format
    
    Args:
        csv_file_path: Path to the input CSV file
        json_file_path: Path to the output JSON file (optional)
    """
    # If no output file specified, use the input file name with .json extension
    if json_file_path is None:
        file_name = os.path.splitext(csv_file_path)[0]
        json_file_path = f"{file_name}.json"
    
    try:
        # Read the CSV file
        with open(csv_file_path, 'r', encoding='utf-8') as csv_file:
            # Use DictReader to automatically use the first row as field names
            csv_reader = csv.DictReader(csv_file)
            
            # Convert to list of dictionaries
            data = []
            for row in csv_reader:
                # Process each field - try to convert numeric values
                processed_row = {}
                for key, value in row.items():
                    # Skip empty fields
                    if not value:
                        processed_row[key] = value
                        continue
                    
                    # Try to convert to numeric types if possible
                    try:
                        # Try to convert to int first
                        if value.isdigit():
                            processed_row[key] = int(value)
                        # Then try float
                        elif '.' in value and all(part.isdigit() or part == '' for part in value.split('.')):
                            processed_row[key] = float(value)
                        else:
                            processed_row[key] = value
                    except (ValueError, AttributeError):
                        # If conversion fails, keep as string
                        processed_row[key] = value
                
                data.append(processed_row)
        
        # Write to JSON file
        with open(json_file_path, 'w', encoding='utf-8') as json_file:
            json.dump(data, json_file, indent=2, ensure_ascii=False)
        
        print(f"Conversion complete! JSON file saved at: {json_file_path}")
        print(f"Converted {len(data)} rows from CSV to JSON")
        
    except FileNotFoundError:
        print(f"Error: The file '{csv_file_path}' was not found.")
        sys.exit(1)
    except PermissionError:
        print(f"Error: Permission denied when accessing '{csv_file_path}' or '{json_file_path}'.")
        sys.exit(1)
    except Exception as e:
        print(f"An error occurred: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    # Parse command line arguments
    if len(sys.argv) < 2:
        print("Usage: python convert_csv_to_json.py input.csv [output.json]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    
    # Check if output file is specified
    output_file = None
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    
    # Convert CSV to JSON
    csv_to_json(input_file, output_file) 