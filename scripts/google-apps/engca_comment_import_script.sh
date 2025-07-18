#!/bin/bash

## Vars be varrin'.
FOLDER_PATH="$HOME/Google Drive/My Drive/Comments"
LOG_FILE="$HOME/cron_job.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

## Let people know what's up.
echo "------ [$DATE] LETS GO! -----" >> "$LOG_FILE"
echo "-----------------------------" >> "$LOG_FILE"

echo "Checking for files starting with 'comments-' in: $FOLDER_PATH" >> "$LOG_FILE"

# Counter for deleted files
deleted_count=0

# Find and delete files starting with "comments-"
for file in "$FOLDER_PATH"/comments-*; do

  ls "$FOLDER_PATH"  >> "$LOG_FILE"
  echo  "Starting deletion check in: $FOLDER_PATH" >> "$LOG_FILE"
  echo  $file >> "$LOG_FILE"

  # Check if the glob matched any files
   if [ -e "$file" ]; then
        # Check if it's a regular file (not a directory)
  echo  $file >> "$LOG_FILE"
        if [ -f "$file" ]; then
            filename=$(basename "$file")
            echo "Deleting: $filename" >> "$LOG_FILE"
            # Delete the file
            if rm "$file"; then
                echo "DELETED: $file"  >> "$LOG_FILE"
                ((deleted_count++))
            else
                echo "ERROR: Failed to delete $file"  >> "$LOG_FILE"
            fi
        else
            echo "Skipping (not a regular file): $(basename "$file")"
            echo "SKIPPED: $file (not a regular file)"  >> "$LOG_FILE"
        fi
fi
done
sleep 1m      # Wait for deletion to complete

## Go to Safari and download the comments CSV file.
open -a "Safari" https://odi.ethelo.net/admin/decisions/33/comment_moderations/csv_download

 # Wait for the download to complete
echo "Waiting for  download complete" >> "$LOG_FILE"
sleep 1m      # Wait for the download to complete

## Rename comments-2.csv to comments.csv.
cd "$FOLDER_PATH"
mv comments-2.csv comments.csv

## Celebrate.
echo "[$DATE] EngCA comment download complete" >> "$LOG_FILE"
