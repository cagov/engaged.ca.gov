#!/usr/bin/env python3
"""
Scatterplot Generator

This script creates an SVG scatterplot from JSON data, filtering by tension category
and coloring points by subcategory.

Usage:
    python3 make_scatterplot.py input.json "Tension Category" [output.svg] [--title "Chart Title"] [--xlabel "X Label"] [--ylabel "Y Label"]

If no output file is specified, the script will use the tension category as the output filename.
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


def filter_data_by_tension(data: List[Dict[str, Any]], tension_category: str) -> List[Dict[str, Any]]:
    """Filter the data by tension category"""
    filtered_data = [item for item in data if item.get('TENSION_CATEGORY') == tension_category]
    if not filtered_data:
        print(f"Warning: No data found for tension category '{tension_category}'.")
    return filtered_data


def generate_distinct_colors(count: int) -> List[str]:
    """Generate a list of distinct colors in hex format"""
    color_hsvs = ['#5ed0b9','#70b6e5','#b98acb','#ee8176']
    colors = color_hsvs[:count]
    return colors


def list_categories(data: List[Dict[str, Any]]) -> None:
    """List all unique tension categories in the data"""
    categories = set(item.get('TENSION_CATEGORY') for item in data)
    print("Available tension categories:")
    for category in sorted(categories):
        print(f"- {category}")

def create_svg_scatterplot(
    data: List[Dict[str, Any]],
    output_path: str,
    title: Optional[str] = None,
    xlabel: Optional[str] = None,
    ylabel: Optional[str] = None
) -> None:
    """Create an SVG scatterplot from the filtered data"""
    if not data:
        print("Error: No data to plot.")
        sys.exit(1)
    
    # Extract UMAP coordinates and subcategories
    points = []
    subcategories = set()
    
    for item in data:
        if 'UMAP_1' in item and 'UMAP_2' in item and item['UMAP_1'] is not None and item['UMAP_2'] is not None:
            x = float(item['UMAP_1'])
            y = float(item['UMAP_2'])
            subcat = item.get('SUBCATEGORY', 'Unknown')
            points.append((x, y, subcat))
            subcategories.add(subcat)
    
    if not points:
        print("Error: No valid coordinate data found.")
        sys.exit(1)
    
    # Calculate dimensions and margins
    margin = config.margin
    width = config.width
    height = config.height
    plot_width = width - 2 * margin
    plot_height = height - 2 * margin
    
    # Calculate min and max values for scaling
    min_x = min(p[0] for p in points)
    max_x = max(p[0] for p in points)
    min_y = min(p[1] for p in points)
    max_y = max(p[1] for p in points)
    
    # Add a small padding to the ranges
    x_padding = (max_x - min_x) * 0.05
    y_padding = (max_y - min_y) * 0.05
    min_x -= x_padding
    max_x += x_padding
    min_y -= y_padding
    max_y += y_padding
    
    # Generate colors for subcategories
    subcategories_list = list(subcategories)
    colors = generate_distinct_colors(len(subcategories_list))
    color_map = {subcat: colors[i] for i, subcat in enumerate(subcategories_list)}
    
    # Prepare SVG content
    svg_content = f'''<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="{width + 200}" height="{height}" viewBox="0 0 {width + 200} {height}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <rect width="{width + 200}" height="{height}" fill="white"/>
'''
    
    # Add title if provided
    if title:
        svg_content += f'''    <text x="{margin}" y="{margin/2}" text-anchor="start" font-family="Open Sans" font-size="16" font-weight="bold">{title}</text>
'''

    # center aligned example
    # svg_content += f'''    <text x="{margin + plot_width/2}" y="{margin/2}" text-anchor="middle" font-family="Open Sans" font-size="16" font-weight="bold">{title}</text>
    # '''


    # Add axes
    if xlabel or ylabel:
        svg_content += f'''    <line x1="{margin}" y1="{height - margin}" x2="{width - margin}" y2="{height - margin}" stroke="black" stroke-width="1"/>
        <line x1="{margin}" y1="{margin}" x2="{margin}" y2="{height - margin}" stroke="black" stroke-width="1"/>
    '''
    
    # Add axis labels if provided
    if xlabel:
        svg_content += f'''    <text x="{margin + plot_width/2}" y="{height - margin/3}" text-anchor="middle" font-family="Open Sans" font-size="12">{xlabel}</text>
'''
    if ylabel:
        svg_content += f'''    <text x="{margin/3}" y="{margin + plot_height/2}" text-anchor="middle" font-family="Open Sans" font-size="12" transform="rotate(-90 {margin/3} {margin + plot_height/2})">{ylabel}</text>
'''
    if config.draw_mid_lines:
        svg_content += f'''    <line x1="{margin}" y1="{height/2}" x2="{width - margin}" y2="{height/2}" stroke="gray" stroke-width="0.5"/>
'''
        svg_content += f'''    <line x1="{width/2}" y1="{margin}" x2="{width/2}" y2="{height - margin}" stroke="gray" stroke-width="0.5"/>
'''
    
    # Map coordinates to SVG space and draw points
    for i, (x, y, subcat) in enumerate(points):
        # Scale coordinates to fit in the plot area
        svg_x = margin + ((x - min_x) / (max_x - min_x)) * plot_width
        # Invert y-axis for SVG (0 is at the top)
        svg_y = height - margin - ((y - min_y) / (max_y - min_y)) * plot_height
        color = color_map[subcat]
        
        # Add blend mode attribute if specified
        blend_mode_attr = f' style="mix-blend-mode: {config.dot_blendmode};"' if config.dot_blendmode else ''
        
        svg_content += f'''    <circle class="{config.datapoint_class}" data-idx="{i}" cx="{svg_x}" cy="{svg_y}" r="{config.dot_size}" fill="{color}" fill-opacity="{config.dot_opacity}" stroke="none" stroke-width="0.5"{blend_mode_attr}/>
'''
    
    # Add legend
    legend_x = width + config.legend_offset_x
    legend_y = margin + config.legend_offset_y
    legend_item_height = config.legend_item_height
    
    svg_content += f'''    <text x="{legend_x}" y="{legend_y - 5}" font-family="Open Sans" font-size="12" font-weight="400" fill="#8c90a0">Subcategory</text>
'''
    legend_x +=  config.legend_indent_x # indent legend items
    legend_y +=  config.legend_indent_y
    for i, subcat in enumerate(subcategories_list):
        y_pos = legend_y + i * legend_item_height
        color = color_map[subcat]
        
        # Add colored circle and label for legend item
        svg_content += f'''    <circle cx="{legend_x + 7}" cy="{y_pos + 7}" r="5" fill="{color}" fill-opacity="1.0" stroke="none" stroke-width="0.5"/>
    <text fill="#5e5f66" x="{legend_x + 20}" y="{y_pos + 12}" font-family="Open Sans" font-size="10">{subcat}</text>
'''
    
    # Close SVG
    svg_content += '</svg>'
    
    # Write SVG to file
    # Create directory for output file if it doesn't exist
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(svg_content)
        print(f"Scatterplot saved to {output_path}")
    except Exception as e:
        print(f"Error saving the plot: {str(e)}")
        sys.exit(1)


def main():
    # Set up argument parser
    parser = argparse.ArgumentParser(description="Generate a scatterplot from JSON data based on tension category.")
    parser.add_argument("json_file", help="Path to the input JSON file")
    parser.add_argument("tension_category", nargs="?", help="Tension category to filter by (optional)")
    parser.add_argument("output_file", nargs="?", help="Path to the output SVG file (optional)")
    parser.add_argument("-list", "--list_categories", action="store_true", help="List available tension categories")
    parser.add_argument("-t", "--title", help="Chart title (optional)")
    parser.add_argument("-xlabel", "--xlabel", help="X-axis label (optional)")
    parser.add_argument("-ylabel", "--ylabel", help="Y-axis label (optional)")
    
    args = parser.parse_args()
    
    # Load JSON data
    data = load_json_data(args.json_file)

    if args.list_categories:
        list_categories(data)
        return
    
    # Filter data by tension category
    filtered_data = filter_data_by_tension(data, args.tension_category)
    
    # Determine output file name if not specified
    if not args.output_file:
        # Create a safe filename from tension category
        safe_filename = args.tension_category.replace(" ", "_").replace("/", "_")
        output_file = f"{safe_filename}_scatterplot.svg"
    else:
        output_file = args.output_file
    
    # Create scatterplot
    create_svg_scatterplot(
        filtered_data,
        output_file,
        title=args.title if args.title else f"Scatterplot for '{args.tension_category}'",
        xlabel=args.xlabel,
        ylabel=args.ylabel
    )


if __name__ == "__main__":
    main() 