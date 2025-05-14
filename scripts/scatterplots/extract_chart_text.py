# extract chart text

import argparse
import json

def convert_to_sentence_case(phrase: str) -> str:
    """Prepare a phrase for display"""
    tokens = phrase.split(" ")
    for i, token in enumerate(tokens):
        # if the token contains a lowercase letter, and i is not 0, lowercase the whole token
        if any(c.islower() for c in token) and i != 0:
            tokens[i] = token.lower()
    return " ".join(tokens)


# get filename of json
parser = argparse.ArgumentParser()
parser.add_argument("filename", type=str)
args = parser.parse_args()

# load json
with open(args.filename, "r") as f:
    data = json.load(f)

unique_strings = set()
fields_to_extract = ['TENSION_CATEGORY', 'SUBCATEGORY']
# for each record, extract CATEGORY, and SUBCATEGORY
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
output_filename = args.filename.replace(".json", "_chart_text.json")
with open(output_filename, "w") as f:
    json.dump(output_recs, f, indent=4)

