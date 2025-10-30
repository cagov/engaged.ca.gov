# process_data

import argparse
import csv
import json

current_version = 1

parser = argparse.ArgumentParser(description="Process votes CSV file and output as JSON.")
parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose output")
parser.add_argument("input_file", nargs="?", default=f"E3_data_v{current_version}.csv", help="Input CSV file (default: voting_data.csv)")
parser.add_argument("output_file", nargs="?", default=f"E3_data_v{current_version}.json", help="Output JSON file (default: voting_data.json)")
args = parser.parse_args()

if args.verbose:
    print(f"Processing CSV file: {args.input_file}")
    print(f"Outputting to JSON file: {args.output_file}")

# read the CSV file
# expected fields are COMMENT_ID,REPLY_TO_ID,PARTICIPANT_ID,CONTENT,QUESTION,POSTED_ON,MAIN_IDEA_TYPE,MAIN_IDEA_PRIMARY_THEME,LIKE_COUNT,REPLY_COUNT,MAIN_IDEA_SUBTHEMES
unique_questions = set()
unique_main_ideas = set()
unique_main_idea_primary_themes = set()
unique_main_idea_subthemes = set()

with open(args.input_file, "r", encoding="utf-8-sig") as f:
    reader = csv.reader(f)
    # get the first line of the CSV to determine field order
    headers = next(reader)
    if args.verbose:
        print(f"Headers: {headers}")
    # create a dictionary of field names to indices
    field_indices = {name: i for i, name in enumerate(headers)}
    # print(f"Field indices: {field_indices}")
    records = []
    for row in reader:
        if len(row) == len(field_indices):
            records.append({
                "COMMENT_ID": row[field_indices["COMMENT_ID"]],
                "REPLY_TO_ID": row[field_indices["REPLY_TO_ID"]],
                "PARTICIPANT_ID": row[field_indices["PARTICIPANT_ID"]],
                "CONTENT": row[field_indices["CONTENT"]],
                "QUESTION": row[field_indices["QUESTION"]],
                "POSTED_ON": row[field_indices["POSTED_ON"]],
                "MAIN_IDEA_TYPE": row[field_indices["MAIN_IDEA_TYPE"]],
                "MAIN_IDEA_PRIMARY_THEME": row[field_indices["MAIN_IDEA_PRIMARY_THEME"]],
                "LIKE_COUNT": row[field_indices["LIKE_COUNT"]],
                "REPLY_COUNT": row[field_indices["REPLY_COUNT"]],
                "MAIN_IDEA_SUBTHEMES": row[field_indices["MAIN_IDEA_SUBTHEMES"]],
            })
    # print(f"Records: {records}")

for record in records:
    unique_questions.add(record["QUESTION"])
    unique_main_ideas.add(record["MAIN_IDEA_TYPE"])
    unique_main_idea_primary_themes.add(record["MAIN_IDEA_PRIMARY_THEME"])
    unique_main_idea_subthemes.add(record["MAIN_IDEA_SUBTHEMES"])

# convert the unique sets to sorted lists
unique_questions = sorted(list(unique_questions))
unique_main_ideas = sorted(list(unique_main_ideas))
unique_main_idea_primary_themes = sorted(list(unique_main_idea_primary_themes))
unique_main_idea_subthemes = sorted(list(unique_main_idea_subthemes))

# output the records to a JSON file
output_data = {
    "unique_questions": unique_questions,
    "unique_main_ideas": unique_main_ideas,
    "unique_main_idea_primary_themes": unique_main_idea_primary_themes,
    "unique_main_idea_subthemes": unique_main_idea_subthemes,
}

comments = []
for record in records:
    if record["CONTENT"] != "":
        # print("Processing comment:", record)
        content = record["CONTENT"].replace("\n", " ")
        # replace \u201a\u00c4\u00f4 with '
        content = content.replace("‚Äô", "'") # not working...
        crec = {
            "cid": record["COMMENT_ID"],
            "rid": record["REPLY_TO_ID"],
            "pid": record["PARTICIPANT_ID"],
            "content": record["CONTENT"],
        }
        # add ids for questions, main ideas, and subthemes
        crec["qid"] = unique_questions.index(record["QUESTION"])
        crec["miid"] = unique_main_ideas.index(record["MAIN_IDEA_TYPE"])
        crec["mipid"] = unique_main_idea_primary_themes.index(record["MAIN_IDEA_PRIMARY_THEME"])
        crec["midsid"] = unique_main_idea_subthemes.index(record["MAIN_IDEA_SUBTHEMES"])
        comments.append(crec)

output_data["comments"] = comments

with open(args.output_file, "w") as f:
    json.dump(output_data, f, indent=2)
