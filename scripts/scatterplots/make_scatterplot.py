#!/usr/bin/env python3
"""
Scatterplot Generator

This script creates an SVG scatterplot from JSON data, filtering by tension category
and coloring points by subcategory.  These plots are intended for the webpage 
engaged.ca.gov/lafires-recovery/agenda-setting-data-insights/

There is an option -legend to output just the legend as a separate SVG file (we're doing this so the legend
can be more easily repositioned for mobile).

Usage:
    python3 make_scatterplot.py input.json "Tension Category" [output.svg] 

Normally this script is run by make_all_scatterplots.py, which also generates the legends in various legends.
   
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


def filter_data_by_tension(data: List[Dict[str, Any]], category: str) -> List[Dict[str, Any]]:
    """Filter the data by tension category"""
    fieldname = 'TENSION_CATEGORY' if 'TENSION_CATEGORY' in data[0] else 'CATEGORY'
    filtered_data = [item for item in data if item.get(fieldname) == category]
    if not filtered_data:
        print(f"Warning: No data found for category '{category}'.")
    return filtered_data

def list_categories(data: List[Dict[str, Any]]) -> None:
    """List all unique tension categories in the data"""
    fieldname = 'TENSION_CATEGORY' if 'TENSION_CATEGORY' in data[0] else 'CATEGORY'
    categories = set(item.get(fieldname) for item in data)
    print("Available categories:")
    for category in sorted(categories):
        print(f"- {category}")

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

def create_svg_scatterplot(
    data: List[Dict[str, Any]],
    output_path: str,
    title: Optional[str] = None,
    xlabel: Optional[str] = None,
    ylabel: Optional[str] = None,
    translation_data: Optional[Dict[str, Any]] = None,
    language: Optional[str] = None
) -> None:
    """Create an SVG scatterplot from the filtered data"""
    if not data:
        print("Error: No data to plot.")
        sys.exit(1)
    
    # Extract UMAP coordinates and subcategories
    points, subcategories_list_unused, color_map = setup_subcats(data)
    
    if not points:
        print("Error: No valid coordinate data found.")
        sys.exit(1)
    
    # Calculate dimensions and margins
    margin = config.margin
    width = config.width
    height = config.height
    
    # Calculate min and max values for scaling
    min_x = min(p[0] for p in points)
    max_x = max(p[0] for p in points)
    min_y = min(p[1] for p in points)
    max_y = max(p[1] for p in points)

    # height = width * (max_y - min_y) / (max_x - min_x)
    plot_width = width - 2 * margin
    plot_height = height - 2 * margin
    
    # Add a small padding to the ranges
    x_padding = (max_x - min_x) * config.range_padding_ratio
    y_padding = (max_y - min_y) * config.range_padding_ratio
    min_x -= x_padding
    max_x += x_padding
    min_y -= y_padding
    max_y += y_padding
    
    # Prepare SVG content
    svg_content = f'<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"> '
    
    # TITLES, AXIS LABELS AND MID LINES ARE CURRENTLY UNUSED
    if title:
        svg_content += f'    <text x="{margin}" y="{margin/2}" text-anchor="start" font-family="{config.title_font_family}" font-size="{config.title_font_size}" font-weight="bold">{get_translation(translation_data, title, language)}</text>'

    if xlabel or ylabel:
        svg_content += f'    <line x1="{margin}" y1="{height - margin}" x2="{width - margin}" y2="{height - margin}" stroke="black" stroke-width="1"/>'
        svg_content += f'    <line x1="{margin}" y1="{margin}" x2="{margin}" y2="{height - margin}" stroke="black" stroke-width="1"/>'
    
    # Add axis labels if provided
    if xlabel:
        svg_content += f'    <text x="{margin + plot_width/2}" y="{height - margin/3}" text-anchor="middle" font-family="Open Sans" font-size="12">{get_translation(translation_data, xlabel, language)}</text>'
    if ylabel:
        svg_content += f'    <text x="{margin/3}" y="{margin + plot_height/2}" text-anchor="middle" font-family="Open Sans" font-size="12" transform="rotate(-90 {margin/3} {margin + plot_height/2})">{get_translation(translation_data, ylabel, language)}</text>'
    
    if config.draw_mid_lines:
        svg_content += f'    <line x1="{margin}" y1="{height/2}" x2="{width - margin}" y2="{height/2}" stroke="gray" stroke-width="0.5"/>'
        svg_content += f'    <line x1="{width/2}" y1="{margin}" x2="{width/2}" y2="{height - margin}" stroke="gray" stroke-width="0.5"/>'
    
    # Map coordinates to SVG space and draw points
    for (x, y, subcat, comment_id) in points:
        # Scale coordinates to fit in the plot area
        svg_x = margin + ((x - min_x) / (max_x - min_x)) * plot_width
        # Invert y-axis for SVG (0 is at the top)
        svg_y = height - margin - ((y - min_y) / (max_y - min_y)) * plot_height
        color = color_map[subcat]
        
        # Add blend mode attribute if specified
        blend_mode_attr = f' style="mix-blend-mode: {config.dot_blendmode};"' if config.dot_blendmode else ''

        # this draws a dot and a larger invisible circle which helps with selection
        
        svg_content += f'    <g class="{config.datapoint_class}" data-cid="{comment_id}"><circle class="visible" cx="{svg_x}" cy="{svg_y}" r="{config.dot_radius}" fill="{color}" fill-opacity="{config.dot_opacity}" stroke="none" {blend_mode_attr}/><circle cx="{svg_x}" cy="{svg_y}" r="{config.finger_radius}" fill="white" fill-opacity="0" stroke="none"/></g>'

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

def create_svg_scatterplot_legend(
    data: List[Dict[str, Any]],
    output_path: str,
    translation_data: Optional[Dict[str, Any]] = None,
    language: Optional[str] = None
) -> None:

    if not data:
        print("Error: No data to plot.")
        sys.exit(1)
    
    # Extract UMAP coordinates and subcategories
    points_unused, subcategories_list, color_map = setup_subcats(data)
    print("legend subcategories: ", subcategories_list)
    
    # Calculate dimensions and margins
    width = config.legend_width
    
    # estimate the height of the legend
    height = config.legend_item_height * (len(subcategories_list)+1)
    # add config.legend_line_height for item that needs to be wrapped
    line_break_pos = config.legend_line_break_pos
    if language == 'hy':
        line_break_pos = config.legend_line_break_pos_hy
    num_long_lines = sum([1 for subcat in subcategories_list if len(get_translation(translation_data, subcat, language)) > line_break_pos])
    height += num_long_lines * config.legend_line_height
    height += config.legend_bottom_padding

    
    # Prepare SVG content
    svg_content = f'<?xml version="1.0" encoding="UTF-8" standalone="no"?><svg width="{width}" height="{height}"    viewBox="0 0 {width} {height}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">'

    legend_x = config.legend_offset_x
    if language == "fa":
        legend_x = width - legend_x

    legend_y = config.legend_offset_y
    legend_item_height = config.legend_item_height

    svg_content += f'    <text x="{legend_x}" y="{legend_y - 5}" font-family="{config.legend_title_font_family}" font-size="{config.legend_title_font_size}" font-weight="{config.legend_title_font_weight}" fill="#0F1F2F">{get_translation(translation_data, "Conversation groups", language)}</text>'
    
    indent_x = legend_x + config.legend_indent_x # indent legend items
    if language == "fa":
        indent_x = width - config.legend_offset_x - config.legend_indent_x

    indent_y =  legend_y + config.legend_indent_y
    y_pos = indent_y
    for i, subcat in enumerate(subcategories_list):
        # y_pos = indent_y + i * legend_item_height
        color = color_map[subcat]

        # Define line break position
        line_break_pos = config.legend_line_break_pos
        if language == 'hy':
            line_break_pos = config.legend_line_break_pos_hy
        
        circle_x_pos = indent_x + 7
        if language == "fa":
            circle_x_pos = indent_x - 7

        text_x_pos = indent_x + config.legend_text_offset_x
        if language == "fa":
            text_x_pos = indent_x - config.legend_text_offset_x

        # Add colored circle and label for legend item
        svg_content += f'    <circle cx="{circle_x_pos}" cy="{y_pos + 7}" r="5" fill="{color}" fill-opacity="1.0" stroke="none" stroke-width="0.5"/>'
        display_text = get_translation(translation_data, subcat if subcat is not None else 'Other', language)

        if len(display_text) > line_break_pos:
            # use a two line format, wrapped at approx 40 characters using word breaks
            line_1 = display_text[:line_break_pos]
            line_2 = display_text[line_break_pos:]
            while line_1[-1] != " " and line_2[0] != " ":
                line_2 = line_1[-1] + line_2
                line_1 = line_1[:-1]
            svg_content += f'    <text fill="#444444" x="{text_x_pos}" y="{y_pos + config.legend_text_offset_y}" font-family="{config.legend_item_font_family}" font-size="{config.legend_item_font_size}">{line_1}</text>'
            svg_content += f'    <text fill="#444444" x="{text_x_pos}" y="{y_pos + config.legend_text_offset_y + config.legend_line_height}" font-family="{config.legend_item_font_family}" font-size="{config.legend_item_font_size}">{line_2}</text>'
            y_pos += config.legend_line_height
        else:
            svg_content += f'    <text fill="#444444" x="{text_x_pos}" y="{y_pos + config.legend_text_offset_y}" font-family="{config.legend_item_font_family}" font-size="{config.legend_item_font_size}">{display_text}</text>'
        y_pos += legend_item_height

    svg_content += '</svg>'
    # Write SVG to file
    # Create directory for output file if it doesn't exist
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(svg_content)
        print(f"Scatterplot legend saved to {output_path}")
    except Exception as e:
        print(f"Error saving the plot: {str(e)}")
        sys.exit(1)


def main():
    # Set up argument parser
    parser = argparse.ArgumentParser(description="Generate a scatterplot from JSON data based on tension category.")
    parser.add_argument("json_file", help="Path to the input JSON file")
    parser.add_argument("category", nargs="?", help="Category to filter by (optional)")
    parser.add_argument("-list", "--list_categories", action="store_true", help="List available tension categories")
    parser.add_argument("-t", "--title", help="Chart title (optional)")
    parser.add_argument("-xlabel", "--xlabel", help="X-axis label (optional)")
    parser.add_argument("-ylabel", "--ylabel", help="Y-axis label (optional)")
    parser.add_argument("-lang", "--language", help="Language (only necessary for legends)", default="en")
    parser.add_argument("-out", "--output_file", help="Path to the output SVG file (optional)")
    parser.add_argument("-legend", "--output_legend", action="store_true", help="Output the legend as a separate SVG file")
    args = parser.parse_args()
    
    # Load JSON data
    data = load_json_data(args.json_file)

    # load translation data
    with open("chart_translations.json", "r") as f:
        translation_data = json.load(f)

    if args.list_categories:
        list_categories(data)
        return
    
    # Filter data by tension category (technically no longer needed, now that the files are kept separate)
    filtered_data = filter_data_by_tension(data, args.category)
    
    # Determine output file name if not specified
    if not args.output_file:
        # Create a safe filename from tension category
        safe_filename = args.category.replace(" ", "_").replace("/", "_")
        output_file = f"{safe_filename}_scatterplot.svg"
    else:
        output_file = args.output_file
    
    # Create scatterplot
    if args.output_legend:
        create_svg_scatterplot_legend(
            filtered_data,
            output_file,
            translation_data=translation_data,
            language=args.language
        )
    else:
        create_svg_scatterplot(
            filtered_data,
            output_file,
            title=args.title,
            xlabel=args.xlabel,
            ylabel=args.ylabel
            # translation_data=translation_data,
            # language=args.language
        )


if __name__ == "__main__":
    main() 