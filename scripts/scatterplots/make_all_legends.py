# make scatterplots
import subprocess
import os, json
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('-v', '--version', type=str, default='v4')
parser.add_argument('-force','--force', action='store_true')
args = parser.parse_args()
from scatterplot_config import languages, theme_recs

#  python3 make_scatterplot.py housing_rebuilding_v4.json "Housing and rebuilding" -out plots/housing_rebuilding.svg

out_dir = './plots'

# src_file = 'engca_comment_scatterplot_source_V3.json'
version = args.version

for theme_rec in theme_recs:
    theme = theme_rec['theme']
    filename_root = theme_rec['root']
    src_file_json = f'./data/data_{filename_root}_{version}.json'
    if os.path.exists(src_file_json):
        with open(src_file_json, 'r') as f:
            data = json.load(f)
    # output just the dots here...
    cmd = f'python3 make_scatterplot_legend_json.py {src_file_json} -root_name {filename_root} -out ./plot-legends/legend_{filename_root}.json'
    print(cmd)
    subprocess.run(cmd, shell=True)

