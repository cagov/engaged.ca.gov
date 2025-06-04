# extract chart text

import argparse
import json

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


def convert_to_sentence_case(phrase: str) -> str:
    """Prepare a phrase for display"""
    tokens = phrase.split(" ")
    for i, token in enumerate(tokens):
        # if the token contains a lowercase letter, and i is not 0, lowercase the whole token
        if any(c.islower() for c in token) and i != 0:
            tokens[i] = token.lower()
    return " ".join(tokens)


# get filename of json
version = 'v4'
# load json
unique_strings = set()
fields_to_extract = ['CATEGORY', 'SUBCATEGORY']
# for each record, extract CATEGORY, and SUBCATEGORY

for theme_rec in theme_recs:
    filename_root = theme_rec['root']
    src_file_json = f'./data/data_{filename_root}_{version}.json'
    with open(src_file_json, "r") as f:
        data = json.load(f)
    for record in data:
        for field in fields_to_extract:
            if record[field] is not None and record[field] != "":
                unique_strings.add(record[field])

unique_strings = sorted(list(unique_strings))
output_recs = {}
for s in unique_strings:
    output_recs[s] = {'en':convert_to_sentence_case(s), 'es':'', 'fa':'', 'hy':'', 'ko':'', 'tl':'', 'vi':'',
                      'zh-hans':'', 'zh-hant':'', 'status':'ap_review'}

# output as prettified json
output_filename = "./chart_translations.json"
with open(output_filename, "w") as f:
    json.dump(output_recs, f, indent=4)

