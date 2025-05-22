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
import pandas
import argparse

def csv_to_json(csv_file_path: str, json_file_path: str = None) -> None:
    # Read CSV into pandas DataFrame
    df = pandas.read_csv(csv_file_path)
    
    # Convert to JSON with pretty formatting
    # pandas.to_json doesn't support indentation, so we use json.dumps
    with open(json_file_path, 'w', encoding='utf-8') as f:
        json_str = json.dumps(json.loads(df.to_json(orient="records")), indent=2)
        f.write(json_str)

if __name__ == "__main__":
    # Parse command line arguments
    # Set up argument parser
    parser = argparse.ArgumentParser(description="Convert CSV files to JSON format.")
    parser.add_argument("input_file", help="Path to the input CSV file")
    parser.add_argument("output_file", nargs="?", help="Path to the output JSON file (optional)")
    args = parser.parse_args()
    
    input_file = args.input_file
    output_file = args.output_file
    
    # Convert CSV to JSON
    csv_to_json(input_file, output_file) 