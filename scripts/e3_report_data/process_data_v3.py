# process_data_v3

import argparse
import csv
import io
import json

current_version = 3

parser = argparse.ArgumentParser(description="Process votes CSV file and output as JSON.")
parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose output")
parser.add_argument("input_file", nargs="?", default=f"E3_data_v{current_version}.csv", help="Input CSV file (default: E3_data_v3.csv)")
parser.add_argument("output_file", nargs="?", default=f"E3_data_v{current_version}.json", help="Output JSON file (default: E3_data_v3.json)")
parser.add_argument("theme_map_file", nargs="?", default="E3_theme_map_v2.csv", help="Theme map CSV file (default: E3_theme_map_v2.csv)")
parser.add_argument("solutions_file", nargs="?", default="e3_solution_themes_v3.csv", help="Solutions CSV file (default: e3_solution_themes_v3.csv)")
args = parser.parse_args()

if args.verbose:
    print(f"Processing CSV file: {args.input_file}")
    print(f"Using theme map file: {args.theme_map_file}")
    print(f"Using solutions file: {args.solutions_file}")
    print(f"Outputting to JSON file: {args.output_file}")

# Load theme map to create mappings
theme_name_to_id = {}  # Maps theme name to Main_Theme_ID
subtheme_name_to_id = {}  # Maps subtheme name to Subtheme_ID
subtheme_id_to_theme_id = {}  # Maps Subtheme_ID to Main_Theme_ID
theme_id_to_name = {}  # Maps Main_Theme_ID to theme name
subtheme_id_to_name = {}  # Maps Subtheme_ID to subtheme name

# Try to detect the encoding of the theme map CSV file
encodings_to_try = ["cp1252", "utf-8-sig", "latin-1", "utf-8"]
theme_map_encoding = None
theme_map_content = None

for encoding in encodings_to_try:
    try:
        with open(args.theme_map_file, "r", encoding=encoding) as f:
            theme_map_content = f.read()
        if "‚Äô" in theme_map_content or "â€™" in theme_map_content:
            if args.verbose:
                print(f"Found mojibake characters with {encoding}, trying next encoding...")
            continue
        theme_map_encoding = encoding
        if args.verbose:
            print(f"Successfully read theme map CSV with encoding: {encoding}")
        break
    except (UnicodeDecodeError, UnicodeError):
        if args.verbose:
            print(f"Failed to read theme map with {encoding}, trying next encoding...")
        continue

if theme_map_encoding is None:
    theme_map_encoding = "utf-8-sig"
    if args.verbose:
        print(f"Using fallback encoding for theme map: {theme_map_encoding}")
    with open(args.theme_map_file, "r", encoding=theme_map_encoding) as f:
        theme_map_content = f.read()

# Parse theme map CSV
with io.StringIO(theme_map_content) as f:
    reader = csv.DictReader(f)
    for row in reader:
        main_theme = row["Main_theme"].strip()
        subtheme = row["Subtheme"].strip()
        main_theme_id = int(row["Main_Theme_ID"])
        subtheme_id = int(row["Subtheme_ID"])
        
        # Store mappings
        theme_name_to_id[main_theme] = main_theme_id
        subtheme_name_to_id[subtheme] = subtheme_id
        subtheme_id_to_theme_id[subtheme_id] = main_theme_id
        theme_id_to_name[main_theme_id] = main_theme
        subtheme_id_to_name[subtheme_id] = subtheme

if args.verbose:
    print(f"Loaded {len(theme_name_to_id)} themes and {len(subtheme_name_to_id)} subthemes")

# Try to detect the encoding of the main CSV file
csv_encoding = None
csv_content = None

for encoding in encodings_to_try:
    try:
        with open(args.input_file, "r", encoding=encoding) as f:
            csv_content = f.read()
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
    csv_encoding = "utf-8-sig"
    if args.verbose:
        print(f"Using fallback encoding: {csv_encoding}")
    with open(args.input_file, "r", encoding=csv_encoding) as f:
        csv_content = f.read()

# Now parse the CSV content
with io.StringIO(csv_content) as f:
    reader = csv.reader(f)
    headers = next(reader)
    # Strip BOM characters from headers
    headers = [h.lstrip('\ufeff').lstrip('ï»¿').strip() for h in headers]
    if args.verbose:
        print(f"Headers: {headers}")
    
    field_indices = {name: i for i, name in enumerate(headers)}
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
                "LIKE_COUNT": row[field_indices["LIKE_COUNT"]],
                "COMMENT_MAIN_THEMES": row[field_indices["COMMENT_MAIN_THEMES"]],
                "COMMENT_SUBTHEMES": row[field_indices["COMMENT_SUBTHEMES"]],
            })

# Collect unique values
unique_questions = set()

# First, compute reply counts by counting how many comments reply to each comment
# Only count replies that have content (same as we filter for comments)
reply_counts = {}
for record in records:
    if record["CONTENT"] != "" and record["REPLY_TO_ID"]:
        reply_to_id = record["REPLY_TO_ID"].strip()
        if reply_to_id:
            reply_counts[reply_to_id] = reply_counts.get(reply_to_id, 0) + 1

# Process records and convert to comments
comments = []
for record in records:
    if record["CONTENT"] != "":
        unique_questions.add(record["QUESTION"])
        
        # Clean up content: replace newlines with spaces and fix any encoding issues
        content = record["CONTENT"].replace("\n", " ")
        # Fix double-encoded UTF-8 patterns
        content = content.replace("â€šÃ„Ãº", '"')
        content = content.replace("â€šÃ„Ã¹", '"')
        content = content.replace("â€šÃ„Ã´", "'")
        content = content.replace("â€šÃ„Ã®", "-")
        # Fix common mojibake issues
        content = content.replace("‚Äô", "'")
        content = content.replace("‚Äò", "'")
        content = content.replace("‚Äú", '"')
        content = content.replace("‚Äù", '"')
        content = content.replace("‚Äì", "-")
        content = content.replace("‚Äî", "—")
        content = content.replace("‚Ä¶", "...")
        
        # Parse COMMENT_MAIN_THEMES as JSON array
        theme_ids = []
        theme_names_str = record["COMMENT_MAIN_THEMES"].strip()
        if theme_names_str:
            try:
                theme_names = json.loads(theme_names_str)
                if isinstance(theme_names, list):
                    for theme_name in theme_names:
                        theme_name = theme_name.strip().strip('"')
                        if theme_name in theme_name_to_id:
                            theme_ids.append(theme_name_to_id[theme_name])
                        elif args.verbose:
                            print(f"Warning: Theme '{theme_name}' not found in theme map")
            except json.JSONDecodeError as e:
                if args.verbose:
                    print(f"Warning: Failed to parse COMMENT_MAIN_THEMES for comment {record['COMMENT_ID']}: {e}")
        
        # Parse COMMENT_SUBTHEMES as JSON array
        subtheme_ids = []
        subtheme_names_str = record["COMMENT_SUBTHEMES"].strip()
        if subtheme_names_str:
            try:
                subtheme_names = json.loads(subtheme_names_str)
                if isinstance(subtheme_names, list):
                    for subtheme_name in subtheme_names:
                        subtheme_name = subtheme_name.strip().strip('"')
                        if subtheme_name in subtheme_name_to_id:
                            subtheme_ids.append(subtheme_name_to_id[subtheme_name])
                        elif args.verbose:
                            print(f"Warning: Subtheme '{subtheme_name}' not found in theme map")
            except json.JSONDecodeError as e:
                if args.verbose:
                    print(f"Warning: Failed to parse COMMENT_SUBTHEMES for comment {record['COMMENT_ID']}: {e}")
        
        crec = {
            "cid": record["COMMENT_ID"],
            "rid": record["REPLY_TO_ID"],
            "pid": record["PARTICIPANT_ID"],
            "content": content,
            "date": record["POSTED_ON"],
            "tids": theme_ids,
            "stids": subtheme_ids,
        }
        
        # Add like count as integer
        try:
            crec["likes"] = int(record["LIKE_COUNT"]) if record["LIKE_COUNT"] else 0
        except (ValueError, TypeError):
            crec["likes"] = 0
        
        # Add reply count (computed from REPLY_TO_ID relationships)
        crec["replies"] = reply_counts.get(record["COMMENT_ID"], 0)
        
        comments.append(crec)

# Convert unique sets to sorted lists
unique_questions = sorted(list(unique_questions))

# Count comments per theme
theme_comment_counts = {}
for comment in comments:
    if comment.get("tids"):
        for theme_id in comment["tids"]:
            theme_comment_counts[theme_id] = theme_comment_counts.get(theme_id, 0) + 1

# Sort themes by comment count (descending), then by original ID for tie-breaking
sorted_theme_ids = sorted(
    theme_id_to_name.keys(),
    key=lambda tid: (-theme_comment_counts.get(tid, 0), tid)
)

# Create mapping from old theme ID to new theme ID (1-10)
old_to_new_theme_id = {}
for new_id, old_id in enumerate(sorted_theme_ids, start=1):
    old_to_new_theme_id[old_id] = new_id

if args.verbose:
    print("Theme reordering by comment count:")
    for old_id in sorted_theme_ids:
        count = theme_comment_counts.get(old_id, 0)
        new_id = old_to_new_theme_id[old_id]
        print(f"  Theme {new_id} (was {old_id}): {theme_id_to_name[old_id]} - {count} comments")

# Update theme IDs in comments
for comment in comments:
    if comment.get("tids"):
        comment["tids"] = [old_to_new_theme_id[tid] for tid in comment["tids"] if tid in old_to_new_theme_id]

# Build theme metadata with new IDs
themes = []
for old_id in sorted_theme_ids:
    new_id = old_to_new_theme_id[old_id]
    themes.append({
        "id": new_id,
        "name": theme_id_to_name[old_id]
    })

# Build subtheme metadata with updated parent theme IDs
subthemes = []
for subtheme_id in sorted(subtheme_id_to_name.keys()):
    old_parent_theme_id = subtheme_id_to_theme_id[subtheme_id]
    new_parent_theme_id = old_to_new_theme_id.get(old_parent_theme_id, old_parent_theme_id)
    subthemes.append({
        "id": subtheme_id,
        "name": subtheme_id_to_name[subtheme_id],
        "parent_theme_id": new_parent_theme_id
    })

# Process solutions CSV file
solutions = []  # Will contain processed solutions
solutions_dict = {}  # Maps SOLUTION_ID to solution data
solution_theme_subtheme_map = {}  # Maps SOLUTION_ID to sets of (theme_id, subtheme_id) tuples

# Try to detect the encoding of the solutions CSV file
solutions_encoding = None
solutions_content = None

for encoding in encodings_to_try:
    try:
        with open(args.solutions_file, "r", encoding=encoding) as f:
            solutions_content = f.read()
        if "‚Äô" in solutions_content or "â€™" in solutions_content:
            if args.verbose:
                print(f"Found mojibake characters in solutions file with {encoding}, trying next encoding...")
            continue
        solutions_encoding = encoding
        if args.verbose:
            print(f"Successfully read solutions CSV with encoding: {encoding}")
        break
    except (UnicodeDecodeError, UnicodeError):
        if args.verbose:
            print(f"Failed to read solutions file with {encoding}, trying next encoding...")
        continue
    except FileNotFoundError:
        if args.verbose:
            print(f"Solutions file not found: {args.solutions_file}")
        break

if solutions_encoding is None and solutions_content is None:
    try:
        solutions_encoding = "utf-8-sig"
        if args.verbose:
            print(f"Using fallback encoding for solutions file: {solutions_encoding}")
        with open(args.solutions_file, "r", encoding=solutions_encoding) as f:
            solutions_content = f.read()
    except FileNotFoundError:
        if args.verbose:
            print(f"Warning: Solutions file not found, skipping solutions processing")
        solutions_content = None

if solutions_content:
    # Parse solutions CSV
    with io.StringIO(solutions_content) as f:
        reader = csv.DictReader(f)
        for row in reader:
            solution_id = row["SOLUTION_ID"].strip()
            comment_id = row["SOLUTION_COMMENT_ID"].strip()
            solution_text = row["SOLUTION_TEXT"].strip()
            solution_shortened = row["SOLUTION_SHORTENED"].strip()
            solution_main_theme = row.get("SOLUTION_MAIN_THEME", "").strip()
            solution_subtheme = row.get("SOLUTION_SUBTHEME", "").strip()
            
            # Initialize solution data if not seen before
            if solution_id not in solutions_dict:
                solutions_dict[solution_id] = {
                    "comment_id": comment_id,
                    "text": solution_text,
                    "shortened": solution_shortened if solution_shortened != solution_text else None
                }
                solution_theme_subtheme_map[solution_id] = set()
            
            # Collect theme/subtheme combinations
            theme_id = None
            subtheme_id = None
            
            if solution_main_theme and solution_main_theme in theme_name_to_id:
                theme_id = theme_name_to_id[solution_main_theme]
            elif args.verbose and solution_main_theme:
                print(f"Warning: Solution theme '{solution_main_theme}' not found in theme map")
            
            if solution_subtheme and solution_subtheme in subtheme_name_to_id:
                subtheme_id = subtheme_name_to_id[solution_subtheme]
            elif args.verbose and solution_subtheme:
                print(f"Warning: Solution subtheme '{solution_subtheme}' not found in theme map")
            
            # Store theme/subtheme combination
            if theme_id is not None or subtheme_id is not None:
                solution_theme_subtheme_map[solution_id].add((theme_id, subtheme_id))

# Convert solutions to list format
solutions = []  # Reset to empty list
for solution_id in sorted(solutions_dict.keys()):  # Sort for consistent ordering
    solution_data = solutions_dict[solution_id]
    
    # Collect theme and subtheme IDs
    theme_ids = set()
    subtheme_ids = set()
    
    for theme_id, subtheme_id in solution_theme_subtheme_map[solution_id]:
        if theme_id is not None:
            theme_ids.add(theme_id)
        if subtheme_id is not None:
            subtheme_ids.add(subtheme_id)
    
    # Convert to lists and map theme IDs using old_to_new_theme_id
    theme_ids_list = sorted([old_to_new_theme_id[tid] for tid in theme_ids if tid in old_to_new_theme_id])
    subtheme_ids_list = sorted(list(subtheme_ids))
    
    solution_obj = {
        "cid": solution_data["comment_id"],
        "text": solution_data["text"],
        "tids": theme_ids_list,
        "stids": subtheme_ids_list
    }
    
    # Only include shortened if it's different from text
    if solution_data["shortened"]:
        solution_obj["shortened"] = solution_data["shortened"]
    
    solutions.append(solution_obj)

# Output the records to a JSON file
output_data = {
    "unique_questions": unique_questions,
    "themes": themes,
    "subthemes": subthemes,
    "comments": comments,
    "solutions": solutions,
}

# Write JSON file with UTF-8 encoding
with open(args.output_file, "w", encoding="utf-8") as f:
    json.dump(output_data, f, indent=2, ensure_ascii=False)

if args.verbose:
    print(f"Processed {len(comments)} comments")
    print(f"Found {len(themes)} themes and {len(subthemes)} subthemes")
    print(f"Processed {len(solutions)} solutions")

