# make scatterplots
import subprocess
import os, json
import argparse
from typing import Dict, List, Optional, Any, Tuple, Set

parser = argparse.ArgumentParser()
parser.add_argument('-v', '--version', type=str, default='v4')
parser.add_argument('-force','--force', action='store_true')
args = parser.parse_args()
import scatterplot_config as config
from scatterplot_config import languages, theme_recs

#  python3 make_scatterplot.py housing_rebuilding_v4.json "Housing and rebuilding" -out plots/housing_rebuilding.svg

out_dir = './plots'

# src_file = 'engca_comment_scatterplot_source_V3.json'
version = args.version

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
    root_name: str
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
            'key': f"findings_{root_name}_{i+1}",
            'subcat_en': subcat,
            'color': color_map[subcat],
            'comment_ids': comment_ids
        })
    return legend_json

legend_dict = {}
for theme_rec in theme_recs:
    theme = theme_rec['theme']
    filename_root = theme_rec['root']
    src_file_json = f'./data/data_{filename_root}_{version}.json'
    if os.path.exists(src_file_json):
        with open(src_file_json, 'r') as f:
            data = json.load(f)
    # output just the dots here...
    data = load_json_data(src_file_json)

    legend_json =     create_svg_scatterplot_legend_json(
        data, root_name=filename_root)
    legend_dict['findings_' + filename_root] = legend_json

# save legend_dict to a json file
with open('dvlegends.cjs', 'w') as f:
    f.write('const legendsData = ')
    json.dump(legend_dict, f, indent=4)
    f.write(';')
    f.write('module.exports = legendsData;')




