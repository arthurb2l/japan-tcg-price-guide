#!/bin/bash
# Deal Hunter — daily cron trigger
# Cron (10am JST = 1am UTC): 0 1 * * * /mnt/c/q/Pokemon/scripts/deal-hunter.sh
cd /mnt/c/q/Pokemon
python3 scripts/deal-hunter.py >> /tmp/deal-hunter.log 2>&1
