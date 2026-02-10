#!/usr/bin/env python3
"""
Plot the distribution of solution comment IDs from e3_solution_themes_v3.csv.

This script reads the CSV file, counts occurrences of each SOLUTION_COMMENT_ID,
sorts them by descending count, and displays them as a scatter plot.
"""

import csv
import argparse
from collections import Counter
import matplotlib.pyplot as plt


def main():
    parser = argparse.ArgumentParser(
        description='Plot solution comment ID distribution'
    )
    parser.add_argument(
        '--title',
        type=str,
        default='Solution Comment ID Distribution',
        help='Title for the plot (default: "Solution Comment ID Distribution")'
    )
    parser.add_argument(
        '--color',
        type=str,
        default='darkblue',
        help='Color for the scatter plot dots (default: darkblue)'
    )
    parser.add_argument(
        '--csv-file',
        type=str,
        default='e3_solution_themes_v3.csv',
        help='Path to the CSV file (default: e3_solution_themes_v3.csv)'
    )
    parser.add_argument(
        '-sols', '--unique_sols',
        action='store_true',
        help='Count unique solution IDs per comment ID instead of record occurrences'
    )
    
    args = parser.parse_args()
    
    # Read CSV and count occurrences or unique solutions
    if args.unique_sols:
        # Track unique solution IDs per comment ID
        comment_solutions = {}
        with open(args.csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                comment_id = row['SOLUTION_COMMENT_ID']
                solution_id = row['SOLUTION_ID']
                if comment_id and solution_id:  # Skip empty values
                    if comment_id not in comment_solutions:
                        comment_solutions[comment_id] = set()
                    comment_solutions[comment_id].add(solution_id)
        
        # Count unique solutions per comment ID
        comment_counts = {comment_id: len(solutions) 
                         for comment_id, solutions in comment_solutions.items()}
    else:
        # Count record occurrences (default behavior)
        comment_counts = Counter()
        with open(args.csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                comment_id = row['SOLUTION_COMMENT_ID']
                if comment_id:  # Skip empty values
                    comment_counts[comment_id] += 1
    
    # Sort by descending count
    sorted_counts = sorted(comment_counts.items(), key=lambda x: x[1], reverse=True)
    
    # Extract counts for plotting
    counts = [count for _, count in sorted_counts]
    
    # Create scatter plot
    plt.figure(figsize=(10, 6))
    plt.scatter(
        range(len(counts)),
        counts,
        s=5,  # Small dots for 2000+ points
        c=args.color,
        alpha=0.6
    )
    
    plt.xlabel('')
    if args.unique_sols:
        plt.ylabel('Unique Solution Count')
        count_label = "unique solutions"
    else:
        plt.ylabel('Record Count')
        count_label = "records"
    plt.title(args.title)
    plt.grid(True, alpha=0.3)
    
    # Print some statistics
    print(f"Total unique comment IDs: {len(counts)}")
    print(f"Total {count_label}: {sum(counts)}")
    print(f"Max {count_label}: {max(counts)}")
    print(f"Min {count_label}: {min(counts)}")
    print(f"Average {count_label}: {sum(counts) / len(counts):.2f}")
    print()
    
    # Print top 50 comment IDs with their counts
    print(f"Top 50 comment IDs by {count_label}:")
    print("-" * 50)
    for i, (comment_id, count) in enumerate(sorted_counts[:50], 1):
        print(f"{i:2d}. Comment ID: {comment_id:8s}  Count: {count}")
    
    plt.tight_layout()
    plt.show()


if __name__ == '__main__':
    main()

