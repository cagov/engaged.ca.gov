# make scatterplots
import subprocess
import os, json
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('-v', '--version', type=str, default='v4')
parser.add_argument('-force','--force', action='store_true')
args = parser.parse_args()

languages = ['en', 'es', 'fa', 'hy', 'ko', 'tl','vi', 'zh-hans', 'zh-hant']

theme_recs = [{'theme':'Debris removal & environmental recovery','root':'environmental_recovery'}, 
       {'theme':'Wildfire prevention prioritization & accountability','root':'wildfire_prevention'}, 
       {'theme':'Climate & community resilience','root':'climate_community_resilience'}, 
       {'theme':'Infrastructure & utilities restoration','root':'infrastructure_restoration'}, 
       {'theme':'Emergency planning & community safety','root':'emergency_planning_safety'}, 
       {'theme':'Housing and rebuilding','root':'housing_rebuilding'}, 
       {'theme':'Financial & legal assistance','root':'financial_legal_assistance'}, 
       {'theme':'Emergency communication','root':'emergency_communication'}, 
       {'theme':'Economic recovery & small business support','root':'economic_recovery'}, 
       {'theme':'Emotional & mental health support','root':'emotional_mental_health'}]
#  python3 make_scatterplot.py housing_rebuilding_v4.json "Housing and rebuilding" -out plots/housing_rebuilding.svg

out_dir = './plots'

# src_file = 'engca_comment_scatterplot_source_V3.json'
version = args.version
new_jsons = set()
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
        new_jsons.add(src_file_json)
        for language in languages:
            print(f"Making {theme} legend in {language}")
            # make scatterplot
            cmd = f'python3 make_scatterplot.py {src_file_json} "{theme}" -legend -lang {language} -out {out_dir}/findings_{filename_root}_{language}_legend.svg'
            print(cmd)
            subprocess.run(cmd, shell=True)

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
    if src_file_json not in new_jsons:
        continue
    if not os.path.exists(src_file_json):
        continue
    # output just the dots here...
    cmd = f'python3 make_scatterplot.py {src_file_json} "{theme}" -out {out_dir}/findings_{filename_root}.svg'
    print(cmd)
    subprocess.run(cmd, shell=True)

# load all the jsons and merge into a single json, saved at src/public/data/engca_comment_scatterplot_source.json
# save cumulative.json to ./src/public/data/engca_comment_scatterplot_source.json
with open('/Users/jbum/Development/ca.gov/engaged.ca.gov/src/public/data/engca_comment_scatterplot_source.json', 'w') as f:
    json.dump(cumulative_json, f)
