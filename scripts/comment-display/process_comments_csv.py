# process votes CSV

import argparse
import csv
import json
import datetime
import sys

current_version = 3

parser = argparse.ArgumentParser(description="Process votes CSV file and output as JSON.")
parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose output")
parser.add_argument("input_file", nargs="?", default=f"./all_votes_all_comments_top5_dates.csv", help="Input CSV file (default: voting_data.csv)")
parser.add_argument("output_file", nargs="?", default=f"lafires_actionplan_display_comments_v{current_version}.json", help="Output JSON file (default: voting_data.json)")
args = parser.parse_args()

if args.verbose:
    print(f"Processing CSV file: {args.input_file}")
    print(f"Outputting to JSON file: {args.output_file}")

# read the CSV file
# expected fields are PARTICIPANT_ID,VOTE_OPTION,VOTE,TARGET_NAME,_FIVETRAN_SYNCED,VOTE_NUMBER,CONSENSUS,COMMENT_ID,COMMENT_CONTENT,LIKE_COUNT,REPLY_COUNT
# ignore unexpected fields, and create a list of records with the expected fields
# use the first line of the CSV to determine field order

# in order of display
topics_indices = {
    "UNDERGROUND_POWER_SAFETY": 1,
    "ENHANCED_WATER_INFRASTRUCTURE": 2, 
    "EMERGENCY_COMMUNICATION_NETWORKS": 3, 
    "FIND_FINANCIAL_SUPPORT": 4, 
    "PERMITTING_SUPPORT_TEAMS": 5, 
}

with open(args.input_file, "r") as f:
    reader = csv.reader(f)
    # get the first line of the CSV to determine field order
    headers = next(reader)
    if args.verbose:
        print(f"Headers: {headers}")
    # create a dictionary of field names to indices
    field_indices = {name: i for i, name in enumerate(headers)}
    # print(f"Field indices: {field_indices}")
    records = []
    line_no = 2
    for row in reader:
        if len(row) == len(field_indices):
            line_no += 1
            # error if row[field_indices["VOTE_OPTION"]] is not in topics_indices
            if row[field_indices["COMMENT_CONTENT"]] == "":
                continue

            v_option = row[field_indices["VOTE_OPTION"]]
            if v_option not in topics_indices:
                print(f"Topic {v_option} not in topics_indices line {line_no}",row)
                sys.exit()
            if row[field_indices["COMMENT_ID"]] == '':
                print(f"MISSING COMMENT ID in line {line_no}",row)
                sys.exit()
            records.append({
                "TOPIC_IDX": topics_indices[row[field_indices["VOTE_OPTION"]]], # renaming stored field for clarity
                # "VOTE": row[field_indices["VOTE"]],
                "VOTE_NUMBER": int(row[field_indices["VOTE_NUMBER"]]) if row[field_indices["VOTE_NUMBER"]] != "" else None,
                "COMMENT_ID": int(row[field_indices["COMMENT_ID"]]),
                "REPLY_TO_ID": int(row[field_indices["REPLY_TO_ID"]]) if row[field_indices["REPLY_TO_ID"]] != "" else None,
                "COMMENT_CONTENT": row[field_indices["COMMENT_CONTENT"]],
                # Convert timestamp string to integer (seconds since epoch, UTC)
                "POSTED_ON": int(
                    datetime.datetime.strptime(
                        row[field_indices["POSTED_ON"]].replace(" Z", ""), "%Y-%m-%d %H:%M:%S.%f"
                    ).timestamp()
                ),
            })
        else:
            print(f"Row {row} has {len(row)} fields, expected {len(field_indices)}")
    
    # sort records by POSTED_ON
    records.sort(key=lambda x: x["POSTED_ON"])
    # for each record with a non-none reply-to-id, reposition it just below the comment whose comment_id matches  the reply-_to_id
    for record in records:
        if record["REPLY_TO_ID"] is not None:
            for other_record in records:
                if other_record["COMMENT_ID"] == record["REPLY_TO_ID"]:
                    record["COMMENT_ID"] = other_record["COMMENT_ID"] + 0.5
                    record["VOTE_NUMBER"] = other_record["VOTE_NUMBER"]
                    break
    # sort records by POSTED_ON
    records.sort(key=lambda x: x["COMMENT_ID"])

    # convert all COMMENT_IDs to integer floor
    for record in records:
        record["COMMENT_ID"] = int(record["COMMENT_ID"])

    comment_list = [{"tidx": record["TOPIC_IDX"], 
                    "cid": record["COMMENT_ID"], 
                    "rid": record["REPLY_TO_ID"], 
                    "vote": record["VOTE_NUMBER"],
                    "content": record["COMMENT_CONTENT"]} for record in records]

    # output the comment_list to a JSON file
    with open(args.output_file, "w") as f:  
        json.dump(comment_list, f, indent=1)

    print(f"Output file: {args.output_file}")