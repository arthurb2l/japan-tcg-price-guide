#!/usr/bin/env python3
"""Per-card data quality scoring. Outputs scores + flags for every card.
Run: python3 scripts/quality-score.py
Output: data/quality-scores.json + summary to stdout
"""
import json, statistics
from datetime import date
from collections import Counter

DATA = '/mnt/c/q/projects/pokemon/data'

with open(f'{DATA}/onepiece-cache.json') as f:
    cache = json.load(f)
with open(f'{DATA}/variant-image-map.json') as f:
    vmap = json.load(f)

mapped_ids = set(vmap['mappings'].keys())
today = date.today()

scores = []
for set_id, cards in cache['sets'].items():
    for c in cards:
        cid = c.get('id','')
        finish = c.get('finish','')
        name = c.get('name', {})
        img = c.get('img', {})
        pricing = c.get('pricing', {})
        computed = pricing.get('computed', {})
        sources = pricing.get('sources', {})

        # CARD ACCURACY (0-100)
        cs = 0; cf = []
        if (name.get('jp') if isinstance(name, dict) else None): cs += 20
        else: cf.append('no_jp_name')
        if (name.get('en') if isinstance(name, dict) else None): cs += 10
        else: cf.append('no_en_name')
        img_jp = (img.get('jp') if isinstance(img, dict) else img) if img else None
        if img_jp: cs += 25
        else: cf.append('no_jp_image')
        img_en = (img.get('en') if isinstance(img, dict) else None) if isinstance(img, dict) else None
        if img_en: cs += 5
        else: cf.append('no_en_image')
        if finish == 'regular': cs += 20
        elif cid in mapped_ids: cs += 20
        else: cf.append('variant_unverified')
        if c.get('rarity'): cs += 10
        else: cf.append('no_rarity')
        if c.get('set') or c.get('setId'): cs += 10
        else: cf.append('no_set')

        # PRICE CONFIDENCE (0-100)
        ps = 0; pf = []
        jpy = computed.get('jpy') or pricing.get('jpy')
        if jpy: ps += 30
        else: pf.append('no_price')
        n_src = len(sources) if isinstance(sources, dict) else 0
        ps += min(n_src * 10, 30)
        if n_src == 0: pf.append('zero_sources')
        elif n_src == 1: pf.append('single_source')
        updated = pricing.get('updated') or ''
        if updated:
            try:
                age = (today - date.fromisoformat(updated[:10])).days
                if age <= 7: ps += 20
                elif age <= 30: ps += 15
                elif age <= 90: ps += 10
                else: pf.append(f'stale_{age}d')
            except: pf.append('bad_date')
        else: pf.append('no_date')
        method = pricing.get('method', '')
        if method in ('consensus-corrected', 'multi-source'): ps += 20
        elif method in ('variant_mapped', 'cardrush'): ps += 15
        elif method == 'cardrush-fill': ps += 10
        elif method == 'manual-estimate': ps += 5; pf.append('manual_estimate')
        else: ps += 5

        scores.append({
            'id': cid, 'finish': finish, 'set': set_id,
            'card': cs, 'card_flags': cf,
            'price': ps, 'price_flags': pf,
            'combined': round((cs + ps) / 2)
        })

# Save
with open(f'{DATA}/quality-scores.json', 'w') as f:
    json.dump({
        'generated': today.isoformat(),
        'total': len(scores),
        'summary': {
            'card_mean': round(statistics.mean(s['card'] for s in scores)),
            'price_mean': round(statistics.mean(s['price'] for s in scores)),
            'combined_mean': round(statistics.mean(s['combined'] for s in scores)),
            'card_below_70': sum(1 for s in scores if s['card'] < 70),
            'price_below_70': sum(1 for s in scores if s['price'] < 70),
        },
        'worst_50': sorted(scores, key=lambda s: s['combined'])[:50],
        'flag_counts': {
            'card': dict(Counter(f for s in scores for f in s['card_flags']).most_common()),
            'price': dict(Counter(f for s in scores for f in s['price_flags']).most_common()),
        }
    }, f, indent=2)

# Print summary
cs = [s['card'] for s in scores]
ps = [s['price'] for s in scores]
print(f'=== QUALITY SCORECARD ({today}) ===')
print(f'Cards: {len(scores)}')
print(f'Card accuracy:  mean={statistics.mean(cs):.0f} median={statistics.median(cs):.0f} <70={sum(1 for x in cs if x<70)}')
print(f'Price confidence: mean={statistics.mean(ps):.0f} median={statistics.median(ps):.0f} <70={sum(1 for x in ps if x<70)}')
print(f'Saved to data/quality-scores.json')
