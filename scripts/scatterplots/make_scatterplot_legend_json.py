#!/usr/bin/env python3
"""
Scatterplot Legend Generator

This script creates a JSON file containing the legend for a given theme.

Usage:
    python3 make_scatterplot_legend_json.py input.json "Tension Category" -out output.json

Normally this script is run by make_all_legends.py, which also generates the legends in various legends.
   
"""

import json
import sys, os
import argparse
import scatterplot_config as config
from typing import Dict, List, Optional, Any, Tuple, Set


def load_json_data(json_file_path: str) -> List[Dict[str, Any]]:
    """Load data from a JSON file"""
    try:
        with open(json_file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: The file '{json_file_path}' was not found.")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"Error: The file '{json_file_path}' is not valid JSON.")
        sys.exit(1)
    except Exception as e:
        print(f"An error occurred when loading the JSON file: {str(e)}")
        sys.exit(1)


def get_translation(translation_data: Dict[str, Any], key: str, language: str) -> str:
    """Get a translation from the translation data"""
    if key in translation_data:
        return translation_data[key][language]
    return key


def setup_subcats(data: List[Dict[str, Any]]) -> Set[str]:
    """Setup the subcategories for the scatterplot"""
    points = []
    subcategories = set()
    for item in data:
        if 'UMAP_1' in item and 'UMAP_2' in item and item['UMAP_1'] is not None and item['UMAP_2'] is not None:
            x = float(item['UMAP_1'])
            y = float(item['UMAP_2'])
            subcat = item.get('SUBCATEGORY', 'Other')
            if subcat == None or subcat == "":
                subcat = "Other"
            comment_id = item.get('COMMENT_ID', -1)
            points.append((x, y, subcat, comment_id))
            subcategories.add(subcat)

    subcategories_list = sorted([(cat if cat is not None else "Other") for cat in subcategories])
    # if one of the list items is None, remove it, and add it to the end of the list
    if any([cat == "Other" for cat in subcategories_list]):
        subcategories_list.remove("Other")
        subcategories_list.append("Other")
    colors = config.color_table[:len(subcategories_list)]
    color_map = {subcat: colors[i] if subcat != "Other" else 'lightgray' for i, subcat in enumerate(subcategories_list)}
 


    return points, subcategories_list, color_map

def create_svg_scatterplot_legend_json(
    data: List[Dict[str, Any]],
    output_path: str,
    root_name: str,
    translation_data: Optional[Dict[str, Any]] = None
) -> None:

    if not data:
        print("Error: No data to plot.")
        sys.exit(1)
    
    # Extract UMAP coordinates and subcategories
    points_unused, subcategories_list, color_map = setup_subcats(data)
    print("legend subcategories: ", subcategories_list)
    

    legend_json = []
    for i, subcat in enumerate(subcategories_list):
        key = f"{root_name}_{i}"
        comment_ids = [item['COMMENT_ID'] for item in data if item['SUBCATEGORY'] == subcat]
        legend_json.append({
            'idx': i+1,
            'key': f"{root_name}_{i+1}",
            'subcat_en': subcat,
            'color': color_map[subcat],
            'comment_ids': comment_ids
        })
    # Write SVG to file
    # Create directory for output file if it doesn't exist
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(legend_json, f, indent=4)
        print(f"Scatterplot legend saved to {output_path}")
    except Exception as e:
        print(f"Error saving the plot: {str(e)}")
        sys.exit(1)


def main():
    # Set up argument parser
    parser = argparse.ArgumentParser(description="Generate a scatterplot from JSON data based on tension category.")
    parser.add_argument("json_file", help="Path to the input JSON file")
    parser.add_argument('-root_name', "--root_name", required=True, help="Root name of the theme")
    parser.add_argument('-out', "--output_file", required=True, help="Path to the output SVG file")
    args = parser.parse_args()
    
    # Load JSON data
    data = load_json_data(args.json_file)

    # load translation data
    with open("chart_translations.json", "r") as f:
        translation_data = json.load(f)

   
    # Filter data by tension category (no longer needed, now that the files are kept separate)
    filtered_data = data # filter_data_by_tension(data, args.category)
    
   
    # Create scatterplot
    create_svg_scatterplot_legend_json(
        filtered_data,
        args.output_file,
        root_name=args.root_name,
        translation_data=translation_data)


if __name__ == "__main__":
    main() 