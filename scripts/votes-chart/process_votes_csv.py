# process votes CSV

import argparse
import csv
import json

current_version = 3

parser = argparse.ArgumentParser(description="Process votes CSV file and output as JSON.")
parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose output")
parser.add_argument("input_file", nargs="?", default=f"voting_data_v{current_version}.csv", help="Input CSV file (default: voting_data.csv)")
parser.add_argument("output_file", nargs="?", default=f"voting_data_v{current_version}.json", help="Output JSON file (default: voting_data.json)")
args = parser.parse_args()

if args.verbose:
    print(f"Processing CSV file: {args.input_file}")
    print(f"Outputting to JSON file: {args.output_file}")

# read the CSV file
# expected fields are PARTICIPANT_ID,VOTE_OPTION,VOTE,TARGET_NAME,_FIVETRAN_SYNCED,VOTE_NUMBER,CONSENSUS,COMMENT_ID,COMMENT_CONTENT,LIKE_COUNT,REPLY_COUNT
# ignore unexpected fields, and create a list of records with the expected fields
# use the first line of the CSV to determine field order
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
    for row in reader:
        if len(row) == len(field_indices):
            records.append({
                "PARTICIPANT_ID": row[field_indices["PARTICIPANT_ID"]],
                "TOPIC": row[field_indices["VOTE_OPTION"]], # renaming stored field for clarity
                "VOTE": row[field_indices["VOTE"]],
                "LONG_TOPIC": row[field_indices["TARGET_NAME"]], # renaming stored field for clarity
                "VOTE_NUMBER": row[field_indices["VOTE_NUMBER"]],
                "CONSENSUS": row[field_indices["CONSENSUS"]],
                "COMMENT_ID": row[field_indices["COMMENT_ID"]],
                "COMMENT_CONTENT": row[field_indices["COMMENT_CONTENT"]],
                "LIKE_COUNT": row[field_indices["LIKE_COUNT"]],
                "REPLY_COUNT": row[field_indices["REPLY_COUNT"]],
                "EVACUATION_ZONE": row[field_indices["EVACUATION_ZONE"]],
                "SUPPORT": row[field_indices["SUPPORT"]],      
            })
    # print(f"Records: {records}")

# walk through the records andcreate a dictionary to assign a unique ascending integer to each participant id
# add this as a new field 'PARTICIPANT_ID_INT'
# sort the records by PARTICIPANT_ID_INT
# write the records to the output file
participant_id_int_dict = {}
participant_id_int = 0
for record in records:
    if record["PARTICIPANT_ID"] not in participant_id_int_dict:
        participant_id_int_dict[record["PARTICIPANT_ID"]] = participant_id_int
        participant_id_int += 1
    record["PARTICIPANT_ID_INT"] = participant_id_int_dict[record["PARTICIPANT_ID"]]

# walk through records and collect non-empty comments into an array of comments, assign an ascending comment_idx to each record, set to -1 for no comment
comment_array = []
comment_idx = 0
for record in records:
    if record["COMMENT_CONTENT"] != "":
        comment_array.append(record["COMMENT_CONTENT"])
        record["COMMENT_IDX"] = comment_idx
        comment_idx += 1
    else:
        record["COMMENT_IDX"] = -1

# collect the unique TOPIC fields, sort them alphabetically, and then make a dictionary of topic name to integer, with the first topic_index 0
# then assign TOPIC_INDEX to each record based on that dictionary
topic_replacement_desc = {
    "UNDERGROUND_POWER_SAFETY": "Bury power lines and equipment safety measures",
    "ENHANCED_WATER_INFRASTRUCTURE": "Improve water systems for firefighting",
    "EMERGENCY_COMMUNICATION_NETWORKS": "Strengthen emergency communication networks",
    "FIND_FINANCIAL_SUPPORT": "Help people find financial support programs",
    "PERMITTING_SUPPORT_TEAMS": "Dedicate teams to support permitting",
}

topic_index_set = set()
topic_index = 0
for record in records:
    if record["TOPIC"] not in topic_index_set:
        topic_name = topic_replacement_desc.get(record["TOPIC"], record["LONG_TOPIC"])
        topic_index_set.add((record["TOPIC"], topic_name, record["CONSENSUS"], record["SUPPORT"]))
        topic_index += 1

topic_index_list = sorted(list(topic_index_set), key=lambda x: x[2])
topic_index_dict = {topic[0]: index for index, topic in enumerate(topic_index_list)}
for record in records:
    record["TOPIC_INDEX"] = topic_index_dict[record["TOPIC"]]


for record in records:
    if 'Palisades' in record["EVACUATION_ZONE"]:
        record["EVAC_ZONE_INDEX"] = 1
    elif 'Eaton' in record["EVACUATION_ZONE"]:
        record["EVAC_ZONE_INDEX"] = 2
    else:
        record["EVAC_ZONE_INDEX"] = 0


if args.verbose:
    print("First few records:")
    for rec in records[:3]:
        print(rec)
        # INSERT_YOUR_CODE
if args.verbose:
    print(f"Number of records: {len(records)}")
    print(f"Number of unique participant_ids: {len(participant_id_int_dict)}")
    print(f"Number of unique topics: {len(topic_index_dict)}")

    print(f"Topic index list: {topic_index_list}")

likert_index_list = ["","Strongly opposed", "Opposed", "Somewhat opposed", "Neutral", "Somewhat supportive", "Supportive", "Strongly supportive"]
evac_zone_labels = ["None","Palisades", "Eaton"]
user_recs = []
for record in records:
    user_recs.append({
        'uid': record['PARTICIPANT_ID_INT'],
        'tid': record['TOPIC_INDEX'],
        'eid': record['EVAC_ZONE_INDEX'],
        'v': int(record['VOTE_NUMBER']),
        'cid': record['COMMENT_IDX']
        })

vote_colors = ['#777777', '#d62728', '#ff7f0e', '#ffbb78', '#bcbd22', '#98df8a', '#2ca02c', '#1f77b4']
vote_colors_hsl = [(),(),(),(),(),(),(),()]
import colorsys

for i in range(len(vote_colors)):
    hex_color = vote_colors[i].lstrip('#')
    r = int(hex_color[0:2], 16) / 255.0
    g = int(hex_color[2:4], 16) / 255.0
    b = int(hex_color[4:6], 16) / 255.0
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    # Convert h, l, s to degrees and percent for more standard HSL representation
    h_deg = int(round(h * 360))
    s_pct = int(round(s * 100))
    l_pct = int(round(l * 100))
    if h_deg >= 360:
        h_deg = 0
    vote_colors_hsl[i] = (h_deg, s_pct, l_pct)

# output_dict will consist of 'topics' (list of topic names, ordered by topic_index), 'nbr_users', 'nbr_votes'
output_dict = {
    'topics': topic_index_list,
    'nbr_users': len(participant_id_int_dict),
    'likert_labels': likert_index_list,
    'evac_zone_labels': evac_zone_labels,
    'vote_colors': vote_colors,
    'vote_colors_hsl': vote_colors_hsl,
    'user_recs': user_recs,
    'comments': comment_array
}


with open(args.output_file, 'w') as f:
    json.dump(output_dict, f, indent=1)

print(f"Output file: {args.output_file}")