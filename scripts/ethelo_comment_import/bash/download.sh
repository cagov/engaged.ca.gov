#!/bin/bash

## Vars be varrin'.
HOME="/Users/zakiya/"
GDRIVE_FOLDER="$HOME""Google Drive/My Drive/Comments"
LOG_FILE=~/comments/download.txt
DOWNLOADED_FILE="$HOME"comments/comments.csv
DATE=$(date '+%Y-%m-%d %H:%M:%S')

## Let people know what's up.
echo "-----------------------------" >> "$LOG_FILE"
echo "[$DATE] STARTING download.sh " >> "$LOG_FILE"
echo "-----------------------------" >> "$LOG_FILE"

### Go to Safari and download the comments CSV file.
open -a "Safari" https://odi.ethelo.net/admin/decisions/33/comment_moderations/csv_download
sleep 5s      # Wait for the download to complete

## @todo Confirm that these commands are needed. They change permissions and remove quarantine attributes.
## @todo Remove repetitive file path declarations.
chmod 777 ~/comments/comments.csv
xattr -d com.apple.comquarantine ~/comments/comments.csv >> "$LOG_FILE"
xattr -c ~/Downloads/comments/comments.csv >> "$LOG_FILE"
xattr -d com.apple.comquarantine ~/comments/comments-XX.csv >> "$LOG_FILE"
xattr -c ~/Downloads/comments/comments-XX.csv >> "$LOG_FILE"

## Move comments.csv to Google Drive folder.
cp ~/comments/comments.csv ~/comments/comments-XX.csv >> "$LOG_FILE"
mv ~/comments/comments-XX.csv "$GDRIVE_FOLDER"/comments.csv

## Clean up download.
rm ~/comments/comments.csv

## Celebrate!
say "you did it!"
echo "ENDING download.sh " >> "$LOG_FILE"
