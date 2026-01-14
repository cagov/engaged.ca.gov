# process_data_v5

import argparse
import csv
import io
import json
from collections import defaultdict, OrderedDict

current_version = 5

omit_reply_solutions = True

parser = argparse.ArgumentParser(description="Process votes CSV file and output as JSON.")
parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose output")
# parser.add_argument("-ors", "--omit_reply_solutions", action="store_true", help="Omit solutions that are associated with a reply to a comment")
parser.add_argument("input_file", nargs="?", default=f"E3_data_v{current_version}.csv", help="Input CSV file (default: E3_data_v5.csv)")
parser.add_argument("output_file", nargs="?", default=f"E3_data_v{current_version}.json", help="Output JSON file (default: E3_data_v5.json)")
parser.add_argument("solutions_file", nargs="?", default="e3_solution_themes_v5.csv", help="Solutions CSV file (default: e3_solution_themes_v5.csv)")
args = parser.parse_args()

if args.verbose:
    print(f"Processing CSV file: {args.input_file}")
    print(f"Using solutions file: {args.solutions_file}")
    print(f"Outputting to JSON file: {args.output_file}")

# Common encodings to try for CSV files
encodings_to_try = ["cp1252", "utf-8-sig", "latin-1", "utf-8"]


def read_file_with_encoding(filepath, verbose=False):
    """Try to read a file with various encodings, avoiding mojibake."""
    content = None
    encoding_used = None
    
    for encoding in encodings_to_try:
        try:
            with open(filepath, "r", encoding=encoding) as f:
                content = f.read()
            if "‚Äô" in content or "â€™" in content:
                if verbose:
                    print(f"Found mojibake characters with {encoding}, trying next encoding...")
                continue
            encoding_used = encoding
            if verbose:
                print(f"Successfully read {filepath} with encoding: {encoding}")
            break
        except (UnicodeDecodeError, UnicodeError):
            if verbose:
                print(f"Failed to read {filepath} with {encoding}, trying next encoding...")
            continue
    
    if encoding_used is None:
        encoding_used = "utf-8-sig"
        if verbose:
            print(f"Using fallback encoding for {filepath}: {encoding_used}")
        with open(filepath, "r", encoding=encoding_used) as f:
            content = f.read()
    
    return content


def build_theme_mappings_from_solutions(solutions_filepath, verbose=False):
    """
    Build theme/subtheme mappings directly from solutions file.
    
    Themes are ordered by the number of solutions (descending).
    Subthemes are ordered by: a) the theme they are associated with, and b) within that theme, the order they appear.
    
    Returns:
        tuple: (theme_name_to_id, subtheme_name_to_id, subtheme_id_to_theme_id, 
                theme_id_to_name, subtheme_id_to_name)
    """
    solutions_content = read_file_with_encoding(solutions_filepath, verbose)
    
    # Parse solutions CSV to collect theme/subtheme info
    theme_solution_counts = defaultdict(set)  # Maps theme to set of solution IDs
    subthemes_by_theme = defaultdict(OrderedDict)  # Maps theme to OrderedDict of subthemes
    
    with io.StringIO(solutions_content) as f:
        reader = csv.DictReader(f)
        appearance_order = 0
        
        for row in reader:
            solution_id = row["IDEA_ID"].strip()
            solution_main_theme = row.get("IDEA_MAIN_THEME", "").strip()
            solution_subtheme = row.get("IDEA_SUBTHEME", "").strip()
            
            if not solution_main_theme or not solution_subtheme:
                continue
            
            # Count unique solutions per theme
            theme_solution_counts[solution_main_theme].add(solution_id)
            
            # Track subtheme order within theme
            if solution_main_theme not in subthemes_by_theme:
                subthemes_by_theme[solution_main_theme] = OrderedDict()
            
            if solution_subtheme not in subthemes_by_theme[solution_main_theme]:
                subthemes_by_theme[solution_main_theme][solution_subtheme] = appearance_order
                appearance_order += 1
    
    # Sort themes by solution count (descending), then alphabetically for tie-breaking
    sorted_themes = sorted(
        theme_solution_counts.keys(),
        key=lambda theme: (-len(theme_solution_counts[theme]), theme)
    )
    
    if verbose:
        print("Themes ordered by solution count:")
        for theme in sorted_themes:
            count = len(theme_solution_counts[theme])
            print(f"  {theme}: {count} solutions")
    
    # Build mappings with IDs assigned in sorted order
    theme_name_to_id = {}
    subtheme_name_to_id = {}
    subtheme_id_to_theme_id = {}
    theme_id_to_name = {}
    subtheme_id_to_name = {}
    
    main_theme_id = 1
    subtheme_id = 1
    
    for theme in sorted_themes:
        theme_name_to_id[theme] = main_theme_id
        theme_id_to_name[main_theme_id] = theme
        
        # Get subthemes for this theme, sorted by appearance order
        subthemes = list(subthemes_by_theme[theme].keys())
        subthemes_sorted = sorted(
            subthemes,
            key=lambda st: subthemes_by_theme[theme][st]
        )
        
        for subtheme in subthemes_sorted:
            subtheme_name_to_id[subtheme] = subtheme_id
            subtheme_id_to_name[subtheme_id] = subtheme
            subtheme_id_to_theme_id[subtheme_id] = main_theme_id
            subtheme_id += 1
        
        main_theme_id += 1
    
    if verbose:
        print(f"Built mappings: {len(theme_name_to_id)} themes, {len(subtheme_name_to_id)} subthemes")
    
    return (theme_name_to_id, subtheme_name_to_id, subtheme_id_to_theme_id, 
            theme_id_to_name, subtheme_id_to_name)


# Build theme mappings from solutions file
(theme_name_to_id, subtheme_name_to_id, subtheme_id_to_theme_id, 
 theme_id_to_name, subtheme_id_to_name) = build_theme_mappings_from_solutions(
    args.solutions_file, args.verbose
)

# Read the main CSV file
csv_content = read_file_with_encoding(args.input_file, args.verbose)

# Parse the CSV content
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
                # "COMMENT_MAIN_THEMES": row[field_indices["COMMENT_MAIN_THEMES"]],
                # "COMMENT_SUBTHEMES": row[field_indices["COMMENT_SUBTHEMES"]],
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
        
        # # Parse COMMENT_MAIN_THEMES as JSON array
        # theme_ids = []
        # theme_names_str = record["COMMENT_MAIN_THEMES"].strip()
        # if theme_names_str:
        #     try:
        #         theme_names = json.loads(theme_names_str)
        #         if isinstance(theme_names, list):
        #             for theme_name in theme_names:
        #                 theme_name = theme_name.strip().strip('"')
        #                 if theme_name in theme_name_to_id:
        #                     theme_ids.append(theme_name_to_id[theme_name])
        #                 elif args.verbose:
        #                     print(f"Warning: Theme '{theme_name}' not found in theme map")
        #     except json.JSONDecodeError as e:
        #         if args.verbose:
        #             print(f"Warning: Failed to parse COMMENT_MAIN_THEMES for comment {record['COMMENT_ID']}: {e}")
        
        # # Parse COMMENT_SUBTHEMES as JSON array
        # subtheme_ids = []
        # subtheme_names_str = record["COMMENT_SUBTHEMES"].strip()
        # if subtheme_names_str:
        #     try:
        #         subtheme_names = json.loads(subtheme_names_str)
        #         if isinstance(subtheme_names, list):
        #             for subtheme_name in subtheme_names:
        #                 subtheme_name = subtheme_name.strip().strip('"')
        #                 if subtheme_name in subtheme_name_to_id:
        #                     subtheme_ids.append(subtheme_name_to_id[subtheme_name])
        #                 elif args.verbose:
        #                     print(f"Warning: Subtheme '{subtheme_name}' not found in theme map")
        #     except json.JSONDecodeError as e:
        #         if args.verbose:
        #             print(f"Warning: Failed to parse COMMENT_SUBTHEMES for comment {record['COMMENT_ID']}: {e}")
        
        crec = {
            "cid": record["COMMENT_ID"],
            "rid": record["REPLY_TO_ID"],
            "pid": record["PARTICIPANT_ID"],
            "content": content,
            "date": record["POSTED_ON"],
            # "tids": theme_ids,
            # "stids": subtheme_ids,
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

# Build theme metadata (already sorted by solution count from build_theme_mappings_from_solutions)
themes = []
for theme_id in sorted(theme_id_to_name.keys()):
    themes.append({
        "id": theme_id,
        "name": theme_id_to_name[theme_id]
    })

# Build subtheme metadata
subthemes = []
for subtheme_id in sorted(subtheme_id_to_name.keys()):
    parent_theme_id = subtheme_id_to_theme_id[subtheme_id]
    subthemes.append({
        "id": subtheme_id,
        "name": subtheme_id_to_name[subtheme_id],
        "parent_theme_id": parent_theme_id
    })

# Process solutions CSV file
solutions = []  # Will contain processed solutions
solutions_dict = {}  # Maps IDEA_ID to solution data
solution_theme_subtheme_map = {}  # Maps IDEA_ID to sets of (theme_id, subtheme_id) tuples

# Read solutions file (already read during build_theme_mappings_from_solutions, but we need it again for full processing)
try:
    solutions_content = read_file_with_encoding(args.solutions_file, args.verbose)
except FileNotFoundError:
    if args.verbose:
        print(f"Warning: Solutions file not found, skipping solutions processing")
    solutions_content = None

if solutions_content:
    # Parse solutions CSV
    # v4 format columns: IDEA_ID,IDEA_COMMENT_ID,REPLY_TO_ID,SOURCE_COMMENT,IDEA_SEQUENCE,
    #                    IDEA_TEXT,POLISHED_IDEA_SUBTHEMES_ARRAY,NUM_IDEA_SUBTHEMES,
    #                    IDEA_SUBTHEME,IDEA_MAIN_THEME
    with io.StringIO(solutions_content) as f:
        reader = csv.DictReader(f)
        for row in reader:
            solution_id = row["IDEA_ID"].strip()
            comment_id = row["IDEA_COMMENT_ID"].strip()
            solution_text = row["IDEA_TEXT"].strip()
            solution_main_theme = row.get("IDEA_MAIN_THEME", "").strip()
            solution_subtheme = row.get("IDEA_SUBTHEME", "").strip()
            
            # Initialize solution data if not seen before
            # v4 format does not have IDEA_SHORTENED column
            if solution_id not in solutions_dict:
                solutions_dict[solution_id] = {
                    "comment_id": comment_id,
                    "text": solution_text,
                }
                solution_theme_subtheme_map[solution_id] = set()
            
            # Collect theme/subtheme combinations
            theme_id = None
            subtheme_id = None
            
            if solution_main_theme and solution_main_theme in theme_name_to_id:
                theme_id = theme_name_to_id[solution_main_theme]
            elif solution_main_theme:
                print(f"Warning: Solution theme '{solution_main_theme}' not found in theme map")
            
            if solution_subtheme and solution_subtheme in subtheme_name_to_id:
                subtheme_id = subtheme_name_to_id[solution_subtheme]
            elif solution_subtheme:
                print(f"Warning: Solution subtheme '{solution_subtheme}' not found in theme map")
            
            # Store theme/subtheme combination
            if theme_id is not None or subtheme_id is not None:
                solution_theme_subtheme_map[solution_id].add((theme_id, subtheme_id))

# Build set of comment IDs that are replies (for --omit_reply_solutions filtering)
reply_comment_ids = set()
for record in records:
    if record["REPLY_TO_ID"].strip():
        reply_comment_ids.add(record["COMMENT_ID"])

if args.verbose and omit_reply_solutions:
    print(f"Found {len(reply_comment_ids)} comments that are replies")

# Convert solutions to list format
solutions = []  # Reset to empty list
omitted_reply_solutions = 0

# Sort solution IDs numerically if they are integers, otherwise alphabetically
try:
    sorted_solution_ids = sorted(solutions_dict.keys(), key=lambda x: int(x))
except ValueError:
    sorted_solution_ids = sorted(solutions_dict.keys())

for solution_id in sorted_solution_ids:
    solution_data = solutions_dict[solution_id]
    
    # Skip solutions associated with reply comments if flag is set
    if omit_reply_solutions and solution_data["comment_id"] in reply_comment_ids:
        omitted_reply_solutions += 1
        continue
    
    # Collect theme and subtheme IDs
    theme_ids = set()
    subtheme_ids = set()
    
    for theme_id, subtheme_id in solution_theme_subtheme_map[solution_id]:
        if theme_id is not None:
            theme_ids.add(theme_id)
        if subtheme_id is not None:
            subtheme_ids.add(subtheme_id)
    
    # Convert to sorted lists (theme IDs are already in correct order)
    theme_ids_list = sorted(list(theme_ids))
    subtheme_ids_list = sorted(list(subtheme_ids))
    
    solution_obj = {
        "cid": solution_data["comment_id"],
        "text": solution_data["text"],
        "tids": theme_ids_list,
        "stids": subtheme_ids_list
    }
    
    solutions.append(solution_obj)

if args.verbose and omit_reply_solutions:
    print(f"Omitted {omitted_reply_solutions} solutions associated with reply comments")

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

