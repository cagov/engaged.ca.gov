#!/bin/bash

# Set environment
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cd "/Users/zakiya/Google Drive/My Drive/Comments" || exit 1

# Your deletion logic
for file in comments-*; do
    if [ -f "$file" ]; then
        rm -f "$file"
        echo "$(date): Deleted $file" >> /Users/zakiya/deletion_log.txt
    fi
done