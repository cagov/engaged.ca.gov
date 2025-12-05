#!/usr/bin/env python3
"""
Grade a solution based on how accurately it summarizes a proposed solution
from the source comment.

Usage:
    python grade_solution.py "solution text" "source comment text"
    python grade_solution.py --solution_id <id>  # Look up from CSV files

Output: JSON with grade (0-100) and reasoning
"""

import argparse
import csv
import json
import sys

from openai import OpenAI
from config_openai_local import OPENAI_API_KEY, OPENAI_ORG_ID, OPENAI_BASE_URL


def get_openai_client():
    """Initialize OpenAI client with credentials."""
    kwargs = {"api_key": OPENAI_API_KEY}
    if OPENAI_ORG_ID:
        kwargs["organization"] = OPENAI_ORG_ID
    if OPENAI_BASE_URL:
        kwargs["base_url"] = OPENAI_BASE_URL
    return OpenAI(**kwargs)


def grade_solution(client, solution_text, source_comment, model):
    """
    Grade a solution from 0-100 based on accuracy.
    
    Returns JSON with:
    - grade: 0-100
    - has_solution: whether source comment contains a proposed solution
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
        # temperature=0.3,
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


def lookup_solution(solution_id):
    """Look up solution and source comment from CSV files."""
    solutions_file = 'e3_solution_themes_v3.csv'
    comments_file = 'E3_data_v3.csv'
    
    # Find solution
    solution_text = None
    comment_id = None
    
    with open(solutions_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get('SOLUTION_ID', '').strip() == solution_id:
                solution_text = row.get('SOLUTION_TEXT', '').strip()
                comment_id = row.get('SOLUTION_COMMENT_ID', '').strip()
                break
    
    if not solution_text:
        return None, None, f"Solution ID '{solution_id}' not found"
    
    # Find source comment
    source_comment = None
    with open(comments_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get('COMMENT_ID', '').strip() == comment_id:
                source_comment = row.get('CONTENT', '').strip()
                break
    
    if not source_comment:
        return solution_text, None, f"Comment ID '{comment_id}' not found"
    
    return solution_text, source_comment, None


def main():
    parser = argparse.ArgumentParser(
        description='Grade a solution based on accuracy to source comment'
    )
    parser.add_argument(
        'solution_text',
        nargs='?',
        help='The solution summary text'
    )
    parser.add_argument(
        'source_comment',
        nargs='?',
        help='The source comment text'
    )
    parser.add_argument(
        '--solution_id',
        type=str,
        help='Look up solution by ID from CSV files'
    )
    parser.add_argument(
        '-v',
        '--verbose',
        action='store_true',
        help='Include input texts in output'
    )
    parser.add_argument(
        '-m',
        '--model',
        type=str,
        default='gpt-4o-mini',
        help='OpenAI model to use (default: gpt-4o-mini)'
    )
    
    args = parser.parse_args()
    
    # Get solution and comment text
    if args.solution_id:
        solution_text, source_comment, error = lookup_solution(args.solution_id)
        if error:
            print(json.dumps({"error": error}, indent=2))
            sys.exit(1)
    elif args.solution_text and args.source_comment:
        solution_text = args.solution_text
        source_comment = args.source_comment
    else:
        parser.error("Either provide solution_text and source_comment, or --solution_id")
    
    # Initialize client and grade
    client = get_openai_client()
    result = grade_solution(client, solution_text, source_comment, args.model)
    
    # Add input texts if verbose
    if args.verbose:
        result["solution_text"] = solution_text
        result["source_comment"] = source_comment[:500] + "..." if len(source_comment) > 500 else source_comment
    
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()

