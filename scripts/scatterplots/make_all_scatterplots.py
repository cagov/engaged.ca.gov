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

out_dir = './plots'

# src_file = 'engca_comment_scatterplot_source_V3.json'
version = args.version

for theme_rec in theme_recs:
    theme = theme_rec['theme']
    filename_root = theme_rec['root']
    src_file_csv = f'./data/data_{filename_root}_{version}.csv'
    src_file_json = f'./data/data_{filename_root}_{version}.json'
    if not os.path.exists(src_file_csv):
        continue
    if not os.path.exists(src_file_json) or args.force:
        cmd = f'python3 convert_csv_to_json.py {src_file_csv} {src_file_json}'
        print(cmd)
        subprocess.run(cmd, shell=True)
        # no longer used, now that legends are stored in json files
        # for language in languages:
        #     print(f"Making {theme} legend in {language}")
        #     # make scatterplot
        #     cmd = f'python3 make_scatterplot.py {src_file_json} "{theme}" -legend -lang {language} -out {out_dir}/findings_{filename_root}_{language}_legend.svg'
        #     print(cmd)
        #     subprocess.run(cmd, shell=True)

cumulative_json = []
for theme_rec in theme_recs:
    theme = theme_rec['theme']
    filename_root = theme_rec['root']
    src_file_json = f'./data/data_{filename_root}_{version}.json'
    if not os.path.exists(src_file_json):
        continue
    # output just the dots here...
    cmd = f'python3 make_scatterplot.py {src_file_json} "{theme}" -out {out_dir}/findings_{filename_root}.svg'
    print(cmd)
    subprocess.run(cmd, shell=True)

