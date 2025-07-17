#!/bin/bash

open -a "Safari" https://odi.ethelo.net/admin/decisions/33/comment_moderations/csv_download
sleep 1m
cd ~/Google\ Drive/My\ Drive/Comments/

LOG_FILE="$HOME/cron_job.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')
mv comments-2.csv comments.csv
echo "[$DATE] EngCA comment import happened" >> "$LOG_FILE"
