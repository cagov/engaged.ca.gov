# make scatterplots
import subprocess
import os
languages = ['en', 'es', 'fa', 'hy', 'ko', 'tl','vi', 'zh-hans', 'zh-hant']

theme_recs = [{'theme':'Environmental recovery and clean-up','root':'environmental_recovery'}, 
       {'theme':'Wildfire prevention prioritization and accountability','root':'wildfire_prevention'}, 
       {'theme':'Climate and community resilience','root':'climate_community_resilience'}, 
       {'theme':'Infrastructure & utilities restoration','root':'infrastructure_restoration'}, 
       {'theme':'Emergency communication','root':'emergency_planning_safety'}, 
       {'theme':'Housing and rebuilding','root':'housing_rebuilding'}, 
       {'theme':'Financial and legal assistance','root':'financial_legal_assistance'}, 
       {'theme':'Emergency communication','root':'emergency_communication'}, 
       {'theme':'Economic recovery','root':'economic_recovery'}, 
       {'theme':'Emotional and mental health','root':'emotional_mental_health'}]
#  python3 make_scatterplot.py housing_rebuilding_v4.json "Housing and rebuilding" -out plots/housing_rebuilding.svg

out_dir = './plots'

src_file = 'engca_comment_scatterplot_source_V3.json'
version = 'v4'
for theme_rec in theme_recs:
    theme = theme_rec['theme']
    filename_root = theme_rec['root']
    src_file_csv = f'./data/data_{filename_root}_{version}.csv'
    src_file_json = f'./data/data_{filename_root}_{version}.json'
    if not os.path.exists(src_file_csv):
        continue
    if not os.path.exists(src_file_json):
        cmd = f'python3 convert_csv_to_json.py {src_file_csv} {src_file_json}'
        print(cmd)
        subprocess.run(cmd, shell=True)
    for language in languages:
        print(f"Making {theme} legend in {language}")
        # make scatterplot
        cmd = f'python3 make_scatterplot.py {src_file_json} "{theme}" -legend -lang {language} -out {out_dir}/findings_{filename_root}_{language}_legend.svg'
        print(cmd)
        subprocess.run(cmd, shell=True)

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

