# make scatterplots
import subprocess
import os, json
import argparse
from scatterplot_config import languages, theme_recs

parser = argparse.ArgumentParser()
parser.add_argument('-v', '--version', type=str, default='v4')
parser.add_argument('-force','--force', action='store_true')
args = parser.parse_args()

#  python3 make_scatterplot.py housing_rebuilding_v4.json "Housing and rebuilding" -out plots/housing_rebuilding.svg

# src_file = 'engca_comment_scatterplot_source_V3.json'
version = args.version

cumulative_json = []
for theme_rec in theme_recs:
    theme = theme_rec['theme']
    filename_root = theme_rec['root']
    src_file_json = f'./data/data_{filename_root}_{version}.json'
    if os.path.exists(src_file_json):
        with open(src_file_json, 'r') as f:
            data = json.load(f)
        for record in data:
            cumulative_json.append({
                'COMMENT_ID': record['COMMENT_ID'],
                'CONTENT': record['CONTENT']
            })

# load all the jsons and merge into a single json, saved at src/public/data/engca_comment_scatterplot_source.json
# save cumulative.json to ./src/public/data/engca_comment_scatterplot_source.json
with open('../../src/public/data/engca_comment_scatterplot_source.json', 'w') as f:
    json.dump(cumulative_json, f)
