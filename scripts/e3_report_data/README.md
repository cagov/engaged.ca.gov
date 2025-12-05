# E3 Report Data Processing

## Overview

This directory contains scripts for processing E3 (State Employees Efficiency & Effectiveness) engagement data. The main workflow converts CSV data into JSON format for use on the website, with additional analysis and grading tools.

## Python Scripts

### Data Processing

#### `process_data_v3.py`

The main data processing script. Converts E3 engagement data from CSV to JSON format.

**What it does:**
- Reads comment data from `E3_data_v3.csv`
- Loads theme mapping from `E3_theme_map_v2.csv`
- Processes solutions from `e3_solution_themes_v3.csv`
- Handles character encoding issues (mojibake fixes)
- Reorders themes by comment count
- Calculates reply counts for each comment
- Outputs structured JSON with comments, solutions, themes, and subthemes

**Usage:**
```bash
python process_data_v3.py                    # Basic usage with defaults
python process_data_v3.py -v                 # Verbose output
python process_data_v3.py -v -ors            # Omit solutions from reply comments
python process_data_v3.py input.csv output.json theme_map.csv solutions.csv
```

**Options:**
- `-v, --verbose`: Enable verbose output
- `-ors, --omit_reply_solutions`: Filter out solutions associated with reply comments

---

### Analysis Scripts

#### `analyze_reply_trees.py`

Analyzes the reply tree structure of comments. Identifies root comments and counts their total replies (direct and indirect) and maximum depth.

**Usage:**
```bash
python analyze_reply_trees.py
```

**Output:** Ranked list of root comments by total replies, with max depth and summary statistics.

---

#### `analyze_theme_reuse.py`

Analyzes theme reuse patterns. When a comment is used in multiple solutions, checks if the same theme appears multiple times.

**Usage:**
```bash
python analyze_theme_reuse.py
```

**Output:** Statistics on theme reuse, examples of comments with reuse, and themes ranked by number of comments with reuse.

---

#### `plot_solution_comment_counts.py`

Creates a scatter plot showing the distribution of solutions per comment ID.

**Usage:**
```bash
python plot_solution_comment_counts.py                          # Default: count records
python plot_solution_comment_counts.py --unique_sols            # Count unique solution IDs
python plot_solution_comment_counts.py --title "My Title" --color red
```

**Options:**
- `--title`: Custom plot title
- `--color`: Dot color (default: darkblue)
- `-sols, --unique_sols`: Count unique solution IDs instead of records
- `--csv-file`: Path to CSV file (default: e3_solution_themes_v3.csv)

---

#### `find_longest_comment.py`

Finds the longest comment by word count in the dataset.

**Usage:**
```bash
python find_longest_comment.py
```

**Output:** Top 10 longest comments with word counts, and details of the longest comment.

---

### Solution Grading (OpenAI)

These scripts use OpenAI's API to grade how accurately solution summaries reflect their source comments.

#### `config_openai_local.py`

Configuration file for OpenAI API credentials. **Not committed to git.**

Fill in your credentials:
```python
OPENAI_API_KEY = "your-api-key-here"
OPENAI_ORG_ID = None  # Optional
OPENAI_BASE_URL = None  # Optional
```

---

#### `grade_solution.py`

Grades a single solution (0-100) based on how accurately it summarizes a proposed solution from the source comment.

**Usage:**
```bash
python grade_solution.py "solution text" "source comment text"
python grade_solution.py --solution_id <uuid>
python grade_solution.py --solution_id <uuid> -v -m gpt-4o
```

**Options:**
- `--solution_id`: Look up solution by ID from CSV files
- `-v, --verbose`: Include input texts in output
- `-m, --model`: OpenAI model (default: gpt-4o-mini)

**Output:** JSON with grade, accuracy assessment, and reasoning.

**Grading criteria:**
- < 50: Source has no solution, or summary misrepresents source
- 50-69: General idea captured but missing details
- 70-100: Accurate, concise summary

---

#### `batch_grade_solutions.py`

Batch grades all solutions using `grade_solution.py`.

**Usage:**
```bash
python batch_grade_solutions.py --limit 10           # Test with 10 solutions
python batch_grade_solutions.py                       # Process all solutions
python batch_grade_solutions.py --resume scored_solutions.json  # Resume from file
python batch_grade_solutions.py -o results.json -m gpt-4o
```

**Options:**
- `--limit N`: Process only N solutions (for testing)
- `-o, --output`: Output JSON file (default: scored_solutions.json)
- `-m, --model`: OpenAI model (default: gpt-4o-mini)
- `--resume FILE`: Skip already-graded solutions
- `--delay SECONDS`: Rate limiting between API calls (default: 0.1)

**Output:**
- stdout: `<solution-id>,<score>` for each processed solution
- JSON file: Full results with grades, accuracy, and reasoning

---

### Legacy Scripts

- `process_data_v1.py`: Original data processing script (v1)
- `process_data_v2.py`: Previous version of data processing (v2)
- `known_themes.py`: Theme definitions (may be used by other scripts)

---

## Data Files

### Input Files

- **`E3_data_v3.csv`**: Comment data with columns:
  - `COMMENT_ID`: Unique identifier
  - `REPLY_TO_ID`: Parent comment ID (if reply)
  - `PARTICIPANT_ID`: Participant identifier
  - `CONTENT`: Comment text
  - `QUESTION`: Question/prompt the comment responds to
  - `POSTED_ON`: Timestamp
  - `LIKE_COUNT`: Number of likes
  - `COMMENT_MAIN_THEMES`: JSON array of main theme names
  - `COMMENT_SUBTHEMES`: JSON array of subtheme names

- **`E3_theme_map_v2.csv`**: Theme/subtheme ID mappings

- **`e3_solution_themes_v3.csv`**: Solution data with theme assignments

### Output Files

- **`E3_data_v3.json`**: Processed data for website use
- **`scored_solutions.json`**: Solution grades (from batch grading)

---

## Output JSON Structure

```json
{
  "unique_questions": ["Question 1", "Question 2", ...],
  "themes": [
    { "id": 1, "name": "Theme Name" }
  ],
  "subthemes": [
    { "id": 1, "name": "Subtheme Name", "parent_theme_id": 1 }
  ],
  "comments": [
    {
      "cid": "comment_id",
      "rid": "reply_to_id",
      "pid": "participant_id",
      "content": "Comment text",
      "date": "2024-01-01",
      "tids": [1, 2],
      "stids": [1, 3],
      "likes": 5,
      "replies": 2
    }
  ],
  "solutions": [
    {
      "cid": "comment_id",
      "text": "Solution text",
      "shortened": "Shortened version",
      "tids": [1],
      "stids": [1, 2]
    }
  ]
}
```
