#!/bin/bash

## Vars be varrin'.
DECISION_ID=$1
HOME="/Users/zakiya/"
GDRIVE_SHARED_FOLDER="$HOME""Google Drive/Shared drives/Engaged California Downloads/Comments/""$DECISION_ID"
## Coda sync only works with My Drive
GDRIVE_MY_FOLDER="$HOME""Google Drive/My Drive/Comments/""$DECISION_ID"
LOG_FILE=~/comments/download.txt
DOWNLOADED_FILE="$HOME"comments/comments.csv
TEMP_FILE=~/comments/comments-$DECISION_ID.csv
DATE=$(date '+%Y-%m-%d %H:%M:%S')

## Let people know what's up.
echo "-----------------------------" >> "$LOG_FILE"
echo "[$DATE] STARTING download.sh for Decision $DECISION_ID " >> "$LOG_FILE"
echo "-----------------------------" >> "$LOG_FILE"

### Go to Safari and download the comments CSV file.
open -a "Safari" https://odi.ethelo.net/admin/decisions/$DECISION_ID/comment_moderations/csv_download
sleep 5s      # Allow time for the download to complete

## Move comments.csv to Google Drive folders.
cp $DOWNLOADED_FILE $TEMP_FILE >> "$LOG_FILE"
cp $TEMP_FILE "$GDRIVE_SHARED_FOLDER"/comments.csv
cp $TEMP_FILE "$GDRIVE_MY_FOLDER"/comments.csv

echo $GDRIVE_FOLDER >> "$LOG_FILE"

## Clean up downloads.
rm $TEMP_FILE
rm $DOWNLOADED_FILE

## Celebrate!
echo "ENDING download.sh $DECISION_ID " >> "$LOG_FILE"
say "script has run"
