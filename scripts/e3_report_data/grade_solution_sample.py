#!/usr/bin/env python3
"""
Grade solutions in solution_sample.csv based on how accurately they summarize
proposed solutions from source comments.

This script:
- Reads solution_sample.csv (COMMENT_ID, SOURCE_COMMENT, SOLUTION_TEXT)
- Grades each solution 0-100 based on accuracy
- Outputs a new CSV with a GRADE column added
- Periodically saves progress to allow resuming if interrupted
- Skips rows that already have grades

Requires OPENROUTER_API_KEY environment variable to be set.

Usage:
    python grade_solution_sample.py                          # Process all
    python grade_solution_sample.py --limit 5                # Test with 5
    python grade_solution_sample.py -m openai/gpt-4o         # Use different model
    python grade_solution_sample.py -o my_output.csv         # Custom output file
"""

import argparse
import csv
import json
import os
import sys
import time

from openai import OpenAI

# OpenRouter API configuration
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY')
OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'


# ============================================================================
# OpenRouter Client Setup
# ============================================================================

def get_openrouter_client():
    """Initialize OpenRouter client using OpenAI-compatible API."""
    if not OPENROUTER_API_KEY:
        print("Error: OPENROUTER_API_KEY environment variable not set", file=sys.stderr)
        sys.exit(1)
    
    return OpenAI(
        api_key=OPENROUTER_API_KEY,
        base_url=OPENROUTER_BASE_URL
    )


# ============================================================================
# Grading Logic
# ============================================================================

def grade_solution(client, solution_text, source_comment, model):
    """
    Grade a solution from 0-100 based on accuracy.
    
    Returns dict with:
    - grade: 0-100
    - has_solution_in_source: whether source comment contains a proposed solution
    - accuracy: how well solution_text reflects the source
    - reasoning: explanation of the grade
    """
    
    prompt = f"""You are evaluating how well a "solution summary" captures a proposed solution from a source comment.

SOURCE COMMENT:
{source_comment}

SOLUTION SUMMARY:
{solution_text}

Grade the solution summary from 0-100 based on these criteria:

1. Does the source comment contain a proposed solution or actionable idea? If NOT, the grade should be below 50.

2. Does the solution summary accurately reflect a solution expressed in the source comment? If the summary is inaccurate, misrepresents the comment, or describes something not in the comment, the grade should be low.

3. Higher grades (70-100) are for summaries that:
   - Accurately capture a clear solution from the comment
   - Are concise but complete
   - Don't add information not in the source

4. Medium grades (50-69) are for summaries that:
   - Capture the general idea but miss important details
   - Are somewhat accurate but could be more precise

5. Low grades (below 50) are for:
   - Source comments with no clear solution (<40)
   - Summaries that misrepresent the source (<30)
   - Completely unrelated summaries (<20)

Respond with ONLY valid JSON in this exact format:
{{
  "grade": <number 0-100>,
  "has_solution_in_source": <true/false>,
  "accuracy": "<high/medium/low/none>",
  "reasoning": "<brief explanation>"
}}"""

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": "You are an expert evaluator. Respond only with valid JSON."},
            {"role": "user", "content": prompt}
        ],
        max_completion_tokens=500
    )
    
    result_text = response.choices[0].message.content.strip()
    
    # Try to parse JSON, handling potential markdown code blocks
    if result_text.startswith("```"):
        # Remove markdown code block
        lines = result_text.split("\n")
        result_text = "\n".join(lines[1:-1])
    
    try:
        result = json.loads(result_text)
    except json.JSONDecodeError:
        # If parsing fails, return error result
        result = {
            "grade": -1,
            "has_solution_in_source": None,
            "accuracy": "error",
            "reasoning": f"Failed to parse response: {result_text[:200]}"
        }
    
    return result


# ============================================================================
# CSV Processing
# ============================================================================

def load_csv(input_file):
    """Load CSV file and return list of dicts."""
    rows = []
    with open(input_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        for row in reader:
            rows.append(row)
    return rows, fieldnames


def save_csv(rows, fieldnames, output_file):
    """Save rows to CSV file."""
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser(
        description='Grade solutions in solution_sample.csv'
    )
    parser.add_argument(
        '-i', '--input',
        type=str,
        default='solution_sample.csv',
        help='Input CSV file (default: solution_sample.csv)'
    )
    parser.add_argument(
        '-o', '--output',
        type=str,
        default=None,
        help='Output CSV file (default: <input>_graded.csv)'
    )
    parser.add_argument(
        '-m', '--model',
        type=str,
        default='x-ai/grok-4.1-fast',
        help='Model to use via OpenRouter (default: x-ai/grok-4.1-fast)'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=None,
        help='Limit number of solutions to grade (for testing)'
    )
    parser.add_argument(
        '--delay',
        type=float,
        default=0.1,
        help='Delay between API calls in seconds (default: 0.1)'
    )
    parser.add_argument(
        '--save-interval',
        type=int,
        default=5,
        help='Save progress every N records (default: 5)'
    )
    parser.add_argument(
        '--include-reasoning',
        action='store_true',
        help='Include reasoning column in output CSV'
    )
    
    args = parser.parse_args()
    
    # Set default output file
    if args.output is None:
        base = args.input.rsplit('.', 1)[0]
        args.output = f"{base}_graded.csv"
    
    # Load CSV
    print(f"Loading {args.input}...", file=sys.stderr)
    rows, fieldnames = load_csv(args.input)
    total_rows = len(rows)
    print(f"Found {total_rows} rows", file=sys.stderr)
    
    # Add GRADE column if not present
    if 'GRADE' not in fieldnames:
        fieldnames = list(fieldnames) + ['GRADE']
    
    # Add REASONING column if requested and not present
    if args.include_reasoning and 'REASONING' not in fieldnames:
        fieldnames = list(fieldnames) + ['REASONING']
    
    # Initialize OpenRouter client
    print(f"Using model: {args.model}", file=sys.stderr)
    client = get_openrouter_client()
    
    # Track progress
    processed = 0
    skipped = 0
    errors = 0
    
    print("", file=sys.stderr)
    print("Processing solutions...", file=sys.stderr)
    print("-" * 60, file=sys.stderr)
    
    for i, row in enumerate(rows):
        # Check limit
        if args.limit and processed >= args.limit:
            break
        
        # Skip if already graded (non-empty GRADE value)
        existing_grade = row.get('GRADE', '').strip()
        if existing_grade and existing_grade != '-1':
            skipped += 1
            continue
        
        # Get source comment and solution text
        source_comment = row.get('SOURCE_COMMENT', '').strip()
        solution_text = row.get('SOLUTION_TEXT', '').strip()
        comment_id = row.get('COMMENT_ID', '').strip()
        
        if not source_comment or not solution_text:
            print(f"Row {i+1}: Missing SOURCE_COMMENT or SOLUTION_TEXT, skipping", file=sys.stderr)
            row['GRADE'] = '-1'
            if args.include_reasoning:
                row['REASONING'] = 'Missing data'
            errors += 1
            continue
        
        # Grade the solution
        try:
            result = grade_solution(client, solution_text, source_comment, args.model)
            grade = result.get('grade', -1)
            reasoning = result.get('reasoning', '')
            
            row['GRADE'] = str(grade)
            if args.include_reasoning:
                row['REASONING'] = reasoning
            
            # Output progress
            print(f"Row {i+1} (ID={comment_id}): Grade={grade}", file=sys.stderr)
            processed += 1
            
            # Rate limiting delay
            if args.delay > 0:
                time.sleep(args.delay)
            
            # Periodic save
            if processed % args.save_interval == 0:
                save_csv(rows, fieldnames, args.output)
                print(f"  [Saved progress to {args.output}]", file=sys.stderr)
                
        except Exception as e:
            print(f"Row {i+1}: Error - {str(e)}", file=sys.stderr)
            row['GRADE'] = '-1'
            if args.include_reasoning:
                row['REASONING'] = f'Error: {str(e)}'
            errors += 1
    
    # Final save
    save_csv(rows, fieldnames, args.output)
    
    # Summary
    print("", file=sys.stderr)
    print("=" * 60, file=sys.stderr)
    print("SUMMARY", file=sys.stderr)
    print("=" * 60, file=sys.stderr)
    print(f"Total rows: {total_rows}", file=sys.stderr)
    print(f"Graded: {processed}", file=sys.stderr)
    print(f"Skipped (already graded): {skipped}", file=sys.stderr)
    print(f"Errors: {errors}", file=sys.stderr)
    print(f"Output saved to: {args.output}", file=sys.stderr)
    
    # Calculate grade distribution for newly graded rows
    grades = []
    for row in rows:
        try:
            g = int(row.get('GRADE', -1))
            if g >= 0:
                grades.append(g)
        except ValueError:
            pass
    
    if grades:
        print("", file=sys.stderr)
        print("Grade distribution (all graded rows):", file=sys.stderr)
        print(f"  Count: {len(grades)}", file=sys.stderr)
        print(f"  Average: {sum(grades) / len(grades):.1f}", file=sys.stderr)
        print(f"  Min: {min(grades)}", file=sys.stderr)
        print(f"  Max: {max(grades)}", file=sys.stderr)
        
        # Buckets
        low = sum(1 for g in grades if g < 50)
        medium = sum(1 for g in grades if 50 <= g < 70)
        high = sum(1 for g in grades if g >= 70)
        print(f"  Low (<50): {low}", file=sys.stderr)
        print(f"  Medium (50-69): {medium}", file=sys.stderr)
        print(f"  High (70+): {high}", file=sys.stderr)


if __name__ == '__main__':
    main()

