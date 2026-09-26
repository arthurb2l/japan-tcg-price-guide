#!/usr/bin/env bash
# Local JP price scan — runs on Arthur's PC because Surugaya + Yuyutei block
# GitHub runner IPs. Launched in the background by /triage-q-projects when
# prices are >7 days old. Safe to interrupt: progress is saved every 20 cards,
# the next run resumes (--fresh-days 7), and whatever finished gets published on exit.
#
# Usage: scripts/local-price-scan.sh            # scan + publish
#        scripts/local-price-scan.sh --status   # print last scan date / running state
set -uo pipefail
cd "$(dirname "$0")/.."

LOCK=/tmp/japan-tcg-price-scan.lock
LOG=/tmp/japan-tcg-price-scan.log

if [ "${1:-}" = "--status" ]; then
  read last done_ <<<"$(python3 -c "import json;m=json.load(open('data/prices/onepiece-current.json'))['_meta'];print(m.get('updated','?'),m.get('completed','never'))")"
  if [ -e "$LOCK" ] && kill -0 "$(cat "$LOCK")" 2>/dev/null; then state="running (pid $(cat "$LOCK"), log $LOG)"; else state="idle"; fi
  echo "last_complete=$done_ last_progress=$last state=$state"
  exit 0
fi

if [ -e "$LOCK" ] && kill -0 "$(cat "$LOCK")" 2>/dev/null; then
  echo "Scan already running (pid $(cat "$LOCK"))"; exit 0
fi
echo $$ > "$LOCK"
exec >>"$LOG" 2>&1
echo "=== scan start $(date -Is)"

publish() {
  python3 scripts/yuyutei-version-prices.py || echo "per-version prices failed (keeping last file)"
  python3 scripts/cardrush-version-prices.py || echo "Card Rush version prices failed (keeping last file)"
  python3 scripts/sync-prices-to-cache.py
  git add data/prices data/onepiece-cache.json
  if ! git diff --staged --quiet; then
    git commit -qm "📈 JP price scan (local): $(date +%Y-%m-%d)"
    git pull -q --rebase --autostash origin main && git push -q && echo "Published."
  fi
  rm -f "$LOCK"
}
trap publish EXIT

git pull -q --rebase origin main || { echo "git pull failed — resolve before scanning"; exit 1; }
python3 -u scripts/price-scan.py --resume --fresh-days 7 --save-every 20
