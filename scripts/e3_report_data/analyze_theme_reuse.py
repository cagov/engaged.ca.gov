#!/usr/bin/env python3
"""
Analyze theme reuse: When a comment is used in multiple solutions, 
does the same theme ever get reused?

This script checks if multiple solutions sharing the same comment ID
also share the same theme (either MAIN_THEME or SUBTHEME).
"""

import csv
from collections import defaultdict


def main():
    csv_file = 'e3_solution_themes_v3.csv'
    
    # Track solutions per comment ID
    # Structure: comment_id -> list of (solution_id, main_theme, subtheme)
    comment_solutions = defaultdict(list)
    
    # Read CSV and group solutions by comment ID
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            comment_id = row['SOLUTION_COMMENT_ID']
            solution_id = row['SOLUTION_ID']
            main_theme = row['SOLUTION_MAIN_THEME']
            subtheme = row['SOLUTION_SUBTHEME']
            
            if comment_id and solution_id:  # Skip empty values
                comment_solutions[comment_id].append({
                    'solution_id': solution_id,
                    'main_theme': main_theme,
                    'subtheme': subtheme
                })
    
    # Analyze theme reuse
    comments_with_theme_reuse = []
    comments_with_main_theme_reuse = []
    comments_with_subtheme_reuse = []
    
    for comment_id, solutions in comment_solutions.items():
        # Only check comments with multiple solutions
        if len(solutions) < 2:
            continue
        
        # Check for main theme reuse
        main_themes = [s['main_theme'] for s in solutions if s['main_theme']]
        main_theme_counts = defaultdict(int)
        for theme in main_themes:
            main_theme_counts[theme] += 1
        
        has_main_theme_reuse = any(count > 1 for count in main_theme_counts.values())
        
        # Check for subtheme reuse
        subthemes = [s['subtheme'] for s in solutions if s['subtheme']]
        subtheme_counts = defaultdict(int)
        for theme in subthemes:
            subtheme_counts[theme] += 1
        
        has_subtheme_reuse = any(count > 1 for count in subtheme_counts.values())
        
        # Check if either theme is reused
        has_any_reuse = has_main_theme_reuse or has_subtheme_reuse
        
        if has_any_reuse:
            comments_with_theme_reuse.append({
                'comment_id': comment_id,
                'num_solutions': len(solutions),
                'main_theme_reuse': has_main_theme_reuse,
                'subtheme_reuse': has_subtheme_reuse,
                'main_theme_counts': dict(main_theme_counts),
                'subtheme_counts': dict(subtheme_counts)
            })
        
        if has_main_theme_reuse:
            comments_with_main_theme_reuse.append(comment_id)
        
        if has_subtheme_reuse:
            comments_with_subtheme_reuse.append(comment_id)
    
    # Print results
    print("=" * 70)
    print("THEME REUSE ANALYSIS")
    print("=" * 70)
    print()
    
    total_comments_with_multiple_solutions = sum(
        1 for solutions in comment_solutions.values() if len(solutions) >= 2
    )
    
    print(f"Total comment IDs with multiple solutions: {total_comments_with_multiple_solutions}")
    print(f"Comment IDs with ANY theme reuse: {len(comments_with_theme_reuse)}")
    print(f"Comment IDs with MAIN_THEME reuse: {len(comments_with_main_theme_reuse)}")
    print(f"Comment IDs with SUBTHEME reuse: {len(comments_with_subtheme_reuse)}")
    print()
    
    # Show some examples
    print("=" * 70)
    print("EXAMPLES OF COMMENTS WITH THEME REUSE")
    print("=" * 70)
    print()
    
    # Sort by number of solutions (descending) to show interesting cases
    comments_with_theme_reuse.sort(key=lambda x: x['num_solutions'], reverse=True)
    
    for i, comment_info in enumerate(comments_with_theme_reuse[:20], 1):
        comment_id = comment_info['comment_id']
        print(f"{i}. Comment ID: {comment_id}")
        print(f"   Number of solutions: {comment_info['num_solutions']}")
        
        if comment_info['main_theme_reuse']:
            print("   MAIN_THEME reuse:")
            for theme, count in comment_info['main_theme_counts'].items():
                if count > 1:
                    print(f"      - {theme}: {count} times")
        
        if comment_info['subtheme_reuse']:
            print("   SUBTHEME reuse:")
            for theme, count in comment_info['subtheme_counts'].items():
                if count > 1:
                    print(f"      - {theme}: {count} times")
        print()
    
    # Summary statistics
    print("=" * 70)
    print("SUMMARY STATISTICS")
    print("=" * 70)
    print()
    
    if comments_with_theme_reuse:
        avg_solutions = sum(c['num_solutions'] for c in comments_with_theme_reuse) / len(comments_with_theme_reuse)
        max_solutions = max(c['num_solutions'] for c in comments_with_theme_reuse)
        print(f"Average number of solutions per comment (with reuse): {avg_solutions:.2f}")
        print(f"Maximum number of solutions for a comment (with reuse): {max_solutions}")
        print()
        
        # Count how many have both types of reuse
        both_types = sum(1 for c in comments_with_theme_reuse 
                        if c['main_theme_reuse'] and c['subtheme_reuse'])
        print(f"Comments with BOTH main theme AND subtheme reuse: {both_types}")
    
    # Count comments with reuse per theme
    print()
    print("=" * 70)
    print("THEMES RANKED BY NUMBER OF COMMENTS WITH THEME REUSE")
    print("=" * 70)
    print()
    
    # Track which comments reuse each theme
    main_theme_comment_counts = defaultdict(set)
    subtheme_comment_counts = defaultdict(set)
    
    for comment_id, solutions in comment_solutions.items():
        if len(solutions) < 2:
            continue
        
        # Count themes per comment
        main_themes = [s['main_theme'] for s in solutions if s['main_theme']]
        main_theme_counts = defaultdict(int)
        for theme in main_themes:
            main_theme_counts[theme] += 1
        
        # If a theme appears more than once for this comment, add comment to theme's set
        for theme, count in main_theme_counts.items():
            if count > 1:
                main_theme_comment_counts[theme].add(comment_id)
        
        # Same for subthemes
        subthemes = [s['subtheme'] for s in solutions if s['subtheme']]
        subtheme_counts_dict = defaultdict(int)
        for theme in subthemes:
            subtheme_counts_dict[theme] += 1
        
        for theme, count in subtheme_counts_dict.items():
            if count > 1:
                subtheme_comment_counts[theme].add(comment_id)
    
    # Sort themes by number of comments with reuse
    main_theme_sorted = sorted(
        main_theme_comment_counts.items(),
        key=lambda x: len(x[1]),
        reverse=True
    )
    
    subtheme_sorted = sorted(
        subtheme_comment_counts.items(),
        key=lambda x: len(x[1]),
        reverse=True
    )
    
    print("MAIN THEMES:")
    print("-" * 70)
    for i, (theme, comment_set) in enumerate(main_theme_sorted, 1):
        print(f"{i:2d}. {theme:60s} {len(comment_set):4d} comments")
    print()
    
    print("SUBTHEMES:")
    print("-" * 70)
    for i, (theme, comment_set) in enumerate(subtheme_sorted, 1):
        print(f"{i:2d}. {theme:60s} {len(comment_set):4d} comments")


if __name__ == '__main__':
    main()

