#!/usr/bin/env python3
"""
Convert external markdown links to HTML anchor tags with target="_blank".

This script finds markdown links in the format [label](url) where the URL
is external (starts with http:// or https:// and doesn't go to engaged.ca.gov),
and converts them to HTML anchor tags with target="_blank".
"""

import re
import os
from pathlib import Path

# Base directory for the site files
BASE_DIR = Path(__file__).parent.parent

# Files to process
FILES_TO_PROCESS = [
    "site/en/lafires-recovery/action-plan.mmmd",
    "site/es/lafires-recovery/action-plan.mmmd",
    "site/fa/lafires-recovery/action-plan.mmmd",
    "site/hy/lafires-recovery/action-plan.mmmd",
    "site/ko/lafires-recovery/action-plan.mmmd",
    "site/tl/lafires-recovery/action-plan.mmmd",
    "site/vi/lafires-recovery/action-plan.mmmd",
    "site/zh-hans/lafires-recovery/action-plan.mmmd",
    "site/zh-hant/lafires-recovery/action-plan.mmmd",
]

# Pattern to match markdown links: [label](url)
# This matches [text](http://...), [text](https://...), but not [text](/...)
MARKDOWN_LINK_PATTERN = r'\[([^\]]+)\]\((https?://[^\)]+)\)'

def is_external_url(url):
    """Check if URL is external (not engaged.ca.gov)."""
    return not url.startswith('/') and 'engaged.ca.gov' not in url

def convert_markdown_link(match):
    """Convert a markdown link match to HTML anchor tag."""
    label = match.group(1)
    url = match.group(2)
    
    if is_external_url(url):
        return f'<a href="{url}" target="_blank">{label}</a>'
    else:
        # Return original if internal
        return match.group(0)

def process_file(file_path):
    """Process a single file to convert external markdown links."""
    full_path = BASE_DIR / file_path
    
    if not full_path.exists():
        print(f"Warning: File not found: {full_path}")
        return False
    
    # Read the file
    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find all markdown links
    original_content = content
    content = re.sub(MARKDOWN_LINK_PATTERN, convert_markdown_link, content)
    
    # Check if any changes were made
    if content != original_content:
        # Write back the modified content
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✓ Processed: {file_path}")
        return True
    else:
        print(f"- No changes: {file_path}")
        return False

def main():
    """Main function to process all files."""
    print("Converting external markdown links to HTML anchor tags...")
    print()
    
    changed_count = 0
    for file_path in FILES_TO_PROCESS:
        if process_file(file_path):
            changed_count += 1
    
    print()
    print(f"Processing complete. {changed_count} file(s) modified.")

if __name__ == '__main__':
    main()

