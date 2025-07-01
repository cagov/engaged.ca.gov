#!/usr/bin/env python3
"""
Script to extract translations from plot-legends files and match them with chart_translations.json.
Creates a new translations dictionary using the legend keys instead of the original keys.
"""

import json
import glob
import os

def main():
    # Load the chart translations
    with open('chart_translations.json', 'r', encoding='utf-8') as f:
        chart_translations = json.load(f)
    
    # Initialize the new translations dictionary
    new_translations = {}
    
    # Get all legend files in the plot-legends directory
    legend_files = glob.glob('./plot-legends/legend_*.json')
    
    print(f"Found {len(legend_files)} legend files to process")
    
    # Process each legend file
    for legend_file in legend_files:
        print(f"Processing {legend_file}...")
        
        with open(legend_file, 'r', encoding='utf-8') as f:
            legend_data = json.load(f)
        
        # Process each item in the legend
        for item in legend_data:
            key = item.get('key')
            subcat_en = item.get('subcat_en')
            
            if key and subcat_en:
                # Find the matching translation in chart_translations
                if subcat_en in chart_translations:
                    # Copy the translation data using the legend key
                    new_translations['legends_' + key] = chart_translations[subcat_en]
                    print(f"  Matched '{subcat_en}' -> '{key}'")
                else:
                    print(f"  WARNING: No translation found for '{subcat_en}'")
    
    # Save the new translations to file
    output_file = 'new-translations.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(new_translations, f, indent=4, ensure_ascii=False)
    
    print(f"\nSaved {len(new_translations)} translations to {output_file}")

if __name__ == "__main__":
    main() 