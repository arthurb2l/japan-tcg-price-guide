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
        prev = card.get('pricing') or {}
        prev_jpy = (prev.get('computed') or {}).get('jpy')
        last_known = prev.get('lastKnown')
        if prev_jpy and prev_jpy != floor:  # keep the outgoing price as a reference
            last_known = {'jpy': prev_jpy, 'date': prev.get('updated')}
        card['pricing'] = {
            'sources': sources,
            'computed': {'jpy': floor, 'usd': None, 'eur': None},
            'regional': {'JP': {'jpy': floor, 'floor': vdata.get('floor'), 'reference': vdata.get('reference'), 'confidence': vdata.get('confidence'), 'sources': list(sources.keys()), 'updated': scanned}},
            'method': 'variant_mapped', 'updated': scanned,
            **({'lastKnown': last_known} if last_known else {})
        }
        updated += 1

# Per-version prices (scripts/yuyutei-version-prices.py) override the shared 'parallel'
# bucket above: that bucket gave every parallel of a card the same price (964 versions).
vpath = os.path.join(ROOT, 'data/prices/onepiece-versions.json')
vexact = 0
if os.path.exists(vpath):
    vp = json.load(open(vpath))
    vdate, vmap = vp.get('date') or today, vp.get('versions', {})
    for cards in cache['sets'].values():
        for card in cards:
            v = vmap.get(card.get('officialId'))
            if not v or not str(card.get('finish', '')).startswith('parallel'): continue
            img = card.get('img')
            if isinstance(img, dict) and not img.get('jp'): continue  # EN print: JP listing price doesn't apply
            prev = card.get('pricing') or {}
            prev_jpy = (prev.get('computed') or {}).get('jpy')
            last_known = prev.get('lastKnown')
            if prev_jpy and prev_jpy != v['jpy']:
                last_known = {'jpy': prev_jpy, 'date': prev.get('updated')}
            card['pricing'] = {
                'sources': {'yuyutei': {'jpy': v['jpy'], 'in_stock': v['in_stock'], 'updated': vdate}},
                'computed': {'jpy': v['jpy'], 'usd': None, 'eur': None},
                'method': 'yuyutei-version', 'versionMatch': 'exact', 'updated': vdate,
                **({'lastKnown': last_known} if last_known else {})
            }
            vexact += 1
    print(f'Applied {vexact} per-version prices')

with open(os.path.join(ROOT, 'data/onepiece-cache.json'), 'w') as f:
    json.dump(cache, f, ensure_ascii=False, separators=(',', ':'))
print(f'Synced {updated} cards from prices file to cache')
