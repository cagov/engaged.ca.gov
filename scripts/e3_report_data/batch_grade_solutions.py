#!/usr/bin/env python3
"""
Batch grade all solutions using grade_solution.py.

Walks through each unique solution ID, grades it, and outputs results
to stdout and a JSON file.

Usage:
    python batch_grade_solutions.py --limit 10  # Test with 10 solutions
    python batch_grade_solutions.py              # Process all solutions
"""

import argparse
import csv
import json
import sys
import time

from grade_solution import get_openai_client, grade_solution, lookup_solution


def load_unique_solution_ids(csv_file='e3_solution_themes_v3.csv'):
    """Load all unique solution IDs from the CSV file."""
    solution_ids = set()
    
    with open(csv_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            solution_id = row.get('SOLUTION_ID', '').strip()
            if solution_id:
                solution_ids.add(solution_id)
    
    return sorted(solution_ids)


def main():
    parser = argparse.ArgumentParser(
        description='Batch grade all solutions'
    )
    parser.add_argument(
        '--limit',
        type=int,
        default=None,
        help='Limit number of solutions to process (for testing)'
    )
    parser.add_argument(
        '-o', '--output',
        type=str,
        default='scored_solutions.json',
        help='Output JSON file (default: scored_solutions.json)'
    )
    parser.add_argument(
        '-m', '--model',
        type=str,
        default='gpt-4o-mini',
        help='OpenAI model to use (default: gpt-4o-mini)'
    )
    parser.add_argument(
        '--resume',
        type=str,
        help='Resume from existing JSON file (skip already graded solutions)'
    )
    parser.add_argument(
        '--delay',
        type=float,
        default=0.1,
        help='Delay between API calls in seconds (default: 0.1)'
    )
    
    args = parser.parse_args()
    
    # Load solution IDs
    print("Loading solution IDs...", file=sys.stderr)
    solution_ids = load_unique_solution_ids()
    total_solutions = len(solution_ids)
    print(f"Found {total_solutions} unique solutions", file=sys.stderr)
    
    # Apply limit if specified
    if args.limit:
        solution_ids = solution_ids[:args.limit]
        print(f"Limited to {len(solution_ids)} solutions", file=sys.stderr)
    
    # Load existing results if resuming
    results = {}
    if args.resume:
        try:
            with open(args.resume, 'r') as f:
                results = json.load(f)
            print(f"Loaded {len(results)} existing results from {args.resume}", file=sys.stderr)
        except FileNotFoundError:
            print(f"Resume file not found, starting fresh", file=sys.stderr)
    
    # Initialize OpenAI client
    client = get_openai_client()
    
    # Process each solution
    processed = 0
    errors = 0
    skipped = 0
    
    print("", file=sys.stderr)
    print("Processing solutions...", file=sys.stderr)
    print("-" * 60, file=sys.stderr)
    
    for i, solution_id in enumerate(solution_ids, 1):
        # Skip if already processed (resume mode)
        if solution_id in results:
            skipped += 1
            continue
        
        # Look up solution and comment
        solution_text, source_comment, error = lookup_solution(solution_id)
        
        if error:
            print(f"{solution_id},-1,ERROR: {error}", file=sys.stderr)
            results[solution_id] = {
                "grade": -1,
                "error": error
            }
            errors += 1
            continue
        
        # Grade the solution
        try:
            result = grade_solution(client, solution_text, source_comment, args.model)
            grade = result.get('grade', -1)
            
            # Output to stdout
            print(f"{solution_id},{grade}")
            sys.stdout.flush()
            
            # Store result
            results[solution_id] = result
            processed += 1
            
            # Progress update to stderr
            if processed % 10 == 0:
                print(f"  Processed {processed}/{len(solution_ids) - skipped} (errors: {errors})", file=sys.stderr)
            
            # Rate limiting delay
            if args.delay > 0:
                time.sleep(args.delay)
                
        except Exception as e:
            print(f"{solution_id},-1,EXCEPTION: {str(e)}", file=sys.stderr)
            results[solution_id] = {
                "grade": -1,
                "error": str(e)
            }
            errors += 1
    
    # Save results to JSON file
    print("", file=sys.stderr)
    print("-" * 60, file=sys.stderr)
    print(f"Saving results to {args.output}...", file=sys.stderr)
    
    with open(args.output, 'w') as f:
        json.dump(results, f, indent=2)
    
    # Summary
    print("", file=sys.stderr)
    print("=" * 60, file=sys.stderr)
    print("SUMMARY", file=sys.stderr)
    print("=" * 60, file=sys.stderr)
    print(f"Total solutions: {total_solutions}", file=sys.stderr)
    print(f"Processed: {processed}", file=sys.stderr)
    print(f"Skipped (already done): {skipped}", file=sys.stderr)
    print(f"Errors: {errors}", file=sys.stderr)
    print(f"Results saved to: {args.output}", file=sys.stderr)
    
    # Calculate grade distribution
    grades = [r.get('grade', -1) for r in results.values() if r.get('grade', -1) >= 0]
    if grades:
        print("", file=sys.stderr)
        print("Grade distribution:", file=sys.stderr)
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

