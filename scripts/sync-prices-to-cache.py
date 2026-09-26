#!/usr/bin/env python3
"""Copy variant floor prices from data/prices/onepiece-current.json into data/onepiece-cache.json (what the site reads).
Used by scripts/local-price-scan.sh and the update-jp-prices workflow."""
import json, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
from datetime import date

with open(os.path.join(ROOT, 'data/onepiece-cache.json')) as f: cache = json.load(f)
with open(os.path.join(ROOT, 'data/prices/onepiece-current.json')) as f: prices = json.load(f)

today = date.today().isoformat()
updated = 0

import re as _re
VORDER = ['parallel', 'parallel_theme', 'manga_sp']
for sid, cards in cache['sets'].items():
    for card in cards:
        cid = card.get('id', '')
        finish = card.get('finish', 'regular')
        base_id = _re.sub(r'[-_](p\d+|aa|r\d+)$', '', cid)
        pdata = prices.get('prices', {}).get(base_id, {})
        if not pdata.get('variants'): continue
        variants = pdata['variants']
        if finish == 'regular' or finish.startswith('reprint'):
            vdata = variants.get('normal', {})
        elif finish.startswith('parallel') or finish in ('alternate-art', 'holo'):
            pnum = 1
            m = _re.search(r'parallel-(\d+)', finish)
            if m: pnum = int(m.group(1))
            pvars = [(variants[v]['floor'], v) for v in VORDER if v in variants and variants[v].get('floor')]
            pvars.sort()
            idx = min(pnum - 1, len(pvars) - 1) if pvars else -1
            vdata = variants.get(pvars[idx][1], {}) if idx >= 0 else variants.get('normal', {})
        else:
            vdata = variants.get('normal', {})
        floor = vdata.get('floor') or vdata.get('reference')
        if not floor or not vdata.get('sources'): continue
        scanned = pdata.get('updated') or today  # stamp the scan date, not the sync date
        sources = {src: {'jpy': s.get('sell'), 'in_stock': s.get('in_stock'), 'updated': scanned} for src, s in vdata.get('sources', {}).items()}
        card['pricing'] = {
            'sources': sources,
            'computed': {'jpy': floor, 'usd': None, 'eur': None},
            'regional': {'JP': {'jpy': floor, 'floor': vdata.get('floor'), 'reference': vdata.get('reference'), 'confidence': vdata.get('confidence'), 'sources': list(sources.keys()), 'updated': scanned}},
            'method': 'variant_mapped', 'updated': scanned
        }
        updated += 1

with open(os.path.join(ROOT, 'data/onepiece-cache.json'), 'w') as f:
    json.dump(cache, f, ensure_ascii=False, separators=(',', ':'))
print(f'Synced {updated} cards from prices file to cache')
