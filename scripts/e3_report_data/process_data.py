# process_data

import argparse
import csv
import io
import json

from known_themes import known_themes


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

# Try to detect the encoding of the CSV file
# Common encodings to try: cp1252 (Windows-1252 - most common for Excel exports), utf-8-sig (UTF-8 with BOM), latin-1, utf-8
# Prioritize cp1252 since ‚Äô characters typically indicate Windows-1252 being misread as UTF-8
encodings_to_try = ["cp1252", "utf-8-sig", "latin-1", "utf-8"]
csv_encoding = None
csv_content = None

for encoding in encodings_to_try:
    try:
        with open(args.input_file, "r", encoding=encoding) as f:
            csv_content = f.read()
        # Check if we see mojibake characters that suggest wrong encoding
        if "‚Äô" in csv_content or "â€™" in csv_content:
            if args.verbose:
                print(f"Found mojibake characters with {encoding}, trying next encoding...")
            continue
        csv_encoding = encoding
        if args.verbose:
            print(f"Successfully read CSV with encoding: {encoding}")
        break
    except (UnicodeDecodeError, UnicodeError):
        if args.verbose:
            print(f"Failed to read with {encoding}, trying next encoding...")
        continue

if csv_encoding is None:
    # Fallback to utf-8-sig if all else fails
    csv_encoding = "utf-8-sig"
    if args.verbose:
        print(f"Using fallback encoding: {csv_encoding}")
    with open(args.input_file, "r", encoding=csv_encoding) as f:
        csv_content = f.read()

# Now parse the CSV content
with io.StringIO(csv_content) as f:
    reader = csv.reader(f)
    # get the first line of the CSV to determine field order
    headers = next(reader)
    # Strip BOM characters from headers (appears as ï»¿ when UTF-8 BOM is read as cp1252)
    # Also handle other BOM variations
    headers = [h.lstrip('\ufeff').lstrip('ï»¿').strip() for h in headers]
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
    "known_themes": known_themes,
}

comments = []
for record in records:
    if record["CONTENT"] != "":
        # Clean up content: replace newlines with spaces and fix any encoding issues
        content = record["CONTENT"].replace("\n", " ")
        # Fix common mojibake issues if they exist
        # These are common Windows-1252 to UTF-8 mis-encodings
        content = content.replace("‚Äô", "'")  # Windows-1252 right single quotation mark
        content = content.replace("‚Äò", "'")  # Windows-1252 left single quotation mark
        content = content.replace("‚Äú", '"')  # Windows-1252 left double quotation mark
        content = content.replace("‚Äù", '"')  # Windows-1252 right double quotation mark
        content = content.replace("‚Äì", "-")  # Windows-1252 en dash
        content = content.replace("‚Äî", "—")  # Windows-1252 em dash
        content = content.replace("‚Ä¶", "...")  # Windows-1252 ellipsis
        crec = {
            "cid": record["COMMENT_ID"],
            "rid": record["REPLY_TO_ID"],
            "pid": record["PARTICIPANT_ID"],
            "content": content,  # Use cleaned content
        }
        # add ids for questions, main ideas, and subthemes
        mipid = -1
        for tindex,theme in enumerate(known_themes):
            if theme["csv_name"] == record["MAIN_IDEA_PRIMARY_THEME"]:
                mipid = tindex
                break
        crec["qid"] = unique_questions.index(record["QUESTION"])
        crec["miid"] = unique_main_ideas.index(record["MAIN_IDEA_TYPE"])
        crec["mipid"] = mipid
        crec["midsid"] = unique_main_idea_subthemes.index(record["MAIN_IDEA_SUBTHEMES"])
        comments.append(crec)

output_data["comments"] = comments

# Write JSON file with UTF-8 encoding
with open(args.output_file, "w", encoding="utf-8") as f:
    json.dump(output_data, f, indent=2, ensure_ascii=False)
