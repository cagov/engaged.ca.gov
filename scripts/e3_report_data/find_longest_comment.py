#!/usr/bin/env python3
"""
Find the longest comment by word count.

This script reads E3_data_v3.csv and identifies the comment with the most words.
"""

import csv


def count_words(text):
    """Count words in a text string."""
    if not text:
        return 0
    # Split by whitespace and filter out empty strings
    words = [w.strip() for w in text.split() if w.strip()]
    return len(words)


def main():
    csv_file = 'E3_data_v3.csv'
    
    all_comments = []
    
    with open(csv_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            comment_id = row.get('COMMENT_ID', '').strip()
            content = row.get('CONTENT', '').strip()
            
            if comment_id and content:
                word_count = count_words(content)
                all_comments.append({
                    'comment_id': comment_id,
                    'word_count': word_count,
                    'content': content,
                    'participant_id': row.get('PARTICIPANT_ID', '').strip(),
                    'posted_on': row.get('POSTED_ON', '').strip(),
                    'like_count': row.get('LIKE_COUNT', '').strip()
                })
    
    # Sort by word count descending
    all_comments.sort(key=lambda x: x['word_count'], reverse=True)
    longest_comment = all_comments[0] if all_comments else None
    
    # Show top 10 for verification
    print("Top 10 longest comments by word count:")
    print("-" * 80)
    for i, comment in enumerate(all_comments[:10], 1):
        print(f"{i:2d}. Comment ID {comment['comment_id']:6s} - {comment['word_count']:4d} words")
    print()
    
    # Check comment 3736 specifically
    comment_3736 = next((c for c in all_comments if c['comment_id'] == '3736'), None)
    if comment_3736:
        rank = next((i for i, c in enumerate(all_comments, 1) if c['comment_id'] == '3736'), None)
        print(f"Comment 3736: Rank #{rank}, {comment_3736['word_count']} words")
        print(f"First 100 chars: {comment_3736['content'][:100]}...")
        print()
    
    if longest_comment:
        print("=" * 80)
        print("LONGEST COMMENT BY WORD COUNT")
        print("=" * 80)
        print()
        print(f"Comment ID: {longest_comment['comment_id']}")
        print(f"Word Count: {longest_comment['word_count']}")
        print(f"Participant ID: {longest_comment['participant_id']}")
        print(f"Posted On: {longest_comment['posted_on']}")
        print(f"Like Count: {longest_comment['like_count']}")
        print()
        print("Content (first 500 characters):")
        print("-" * 80)
        print(longest_comment['content'][:500])
        if len(longest_comment['content']) > 500:
            print("...")
            print(f"[Content truncated. Total length: {len(longest_comment['content'])} characters]")
    else:
        print("No comments found.")


if __name__ == '__main__':
    main()

