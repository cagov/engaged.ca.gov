#!/usr/bin/env python3
"""
Analyze reply trees: Find root comments with the most replies.

This script reads E3_data_v3.csv and identifies root comments (comments
that are not replies), then counts total replies (direct and indirect) and
calculates the maximum depth of the reply tree under each root comment.
"""

import csv
from collections import defaultdict


def build_reply_tree(csv_file):
    """
    Build a tree structure of comments and their replies.
    Returns:
        - children: dict mapping comment_id -> list of child comment IDs
        - root_comments: set of root comment IDs (comments with no parent)
        - all_comments: set of all comment IDs
    """
    children = defaultdict(list)
    all_comments = set()
    has_parent = set()
    
    with open(csv_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            comment_id = row.get('COMMENT_ID', '').strip()
            reply_to_id = row.get('REPLY_TO_ID', '').strip()
            
            if comment_id:
                all_comments.add(comment_id)
            
            if reply_to_id:
                # This comment is a reply to reply_to_id
                children[reply_to_id].append(comment_id)
                has_parent.add(comment_id)
    
    # Root comments are those that don't have a parent
    root_comments = all_comments - has_parent
    
    return children, root_comments, all_comments


def count_replies_and_depth(comment_id, children, visited=None):
    """
    Recursively count total replies and find maximum depth under a comment.
    Returns: (total_replies, max_depth)
    """
    if visited is None:
        visited = set()
    
    if comment_id in visited:
        # Cycle detection - shouldn't happen but be safe
        return 0, 0
    
    visited.add(comment_id)
    
    if comment_id not in children or len(children[comment_id]) == 0:
        # Leaf node - no replies
        return 0, 0
    
    total_replies = 0
    max_depth = 0
    
    for child_id in children[comment_id]:
        child_replies, child_depth = count_replies_and_depth(child_id, children, visited.copy())
        total_replies += 1 + child_replies  # +1 for the direct reply
        max_depth = max(max_depth, child_depth + 1)  # +1 for the depth of this level
    
    return total_replies, max_depth


def main():
    csv_file = 'E3_data_v3.csv'
    
    print("Building reply tree structure...")
    children, root_comments, all_comments = build_reply_tree(csv_file)
    
    print(f"Total comments: {len(all_comments)}")
    print(f"Root comments: {len(root_comments)}")
    print()
    
    print("Analyzing reply trees...")
    results = []
    
    for root_id in root_comments:
        total_replies, max_depth = count_replies_and_depth(root_id, children)
        results.append({
            'comment_id': root_id,
            'total_replies': total_replies,
            'max_depth': max_depth
        })
    
    # Sort by total replies descending
    results.sort(key=lambda x: x['total_replies'], reverse=True)
    
    # Print results
    print("=" * 80)
    print("ROOT COMMENTS RANKED BY TOTAL REPLIES")
    print("=" * 80)
    print()
    print(f"{'Rank':<6} {'Comment ID':<12} {'Total Replies':<15} {'Max Depth':<12}")
    print("-" * 80)
    
    for i, result in enumerate(results, 1):
        print(f"{i:<6} {result['comment_id']:<12} {result['total_replies']:<15} {result['max_depth']:<12}")
    
    # Summary statistics
    print()
    print("=" * 80)
    print("SUMMARY STATISTICS")
    print("=" * 80)
    print()
    
    if results:
        total_replies_list = [r['total_replies'] for r in results]
        max_depth_list = [r['max_depth'] for r in results]
        
        print(f"Root comments with replies: {sum(1 for r in results if r['total_replies'] > 0)}")
        print(f"Root comments without replies: {sum(1 for r in results if r['total_replies'] == 0)}")
        print()
        print(f"Maximum total replies under a root: {max(total_replies_list)}")
        print(f"Average total replies (for roots with replies): {sum(total_replies_list) / len([r for r in total_replies_list if r > 0]):.2f}")
        print()
        print(f"Maximum depth: {max(max_depth_list)}")
        print(f"Average max depth (for roots with replies): {sum(max_depth_list) / len([d for d in max_depth_list if d > 0]):.2f}")


if __name__ == '__main__':
    main()

