#!/usr/bin/env python3
"""Per-version One Piece prices from yuyu-tei (#78).

The main scanner prices one 'parallel' bucket per card number, so every parallel of a
card shared one price (964 versions). yuyu-tei lists each version separately with its
own photo, so we match their listing photos to Bandai's image for each officialId
(perceptual hash of the whole card + coarse colour layout), one listing per version.

Writes data/prices/onepiece-versions.json  {date, versions: {officialId: {jpy, in_stock, stock, yyt, alt, c}}}
Image cache: data/.cache/yv/ (gitignored). Only new images are downloaded on re-runs.

Usage: python3 scripts/yuyutei-version-prices.py [--no-fetch]
"""
import json, os, re, sys, html, time, collections, datetime, warnings, subprocess
from urllib.request import Request, urlopen
from urllib.parse import quote
warnings.filterwarnings('ignore')
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from version_match import get, fetch_img, feat, cost, warmth

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CACHE = os.path.join(ROOT, 'data', '.cache', 'yv')
OUT = os.path.join(ROOT, 'data', 'prices', 'onepiece-versions.json')
# Future sets are included on purpose: pages that don't exist yet just return nothing
PAGES = ([f'op{i:02d}' for i in range(1, 26)] + [f'eb{i:02d}' for i in range(1, 9)] + ['prb01', 'prb02', 'prb03'] +
         [f'st{i:02d}' for i in range(1, 46)] + ['promo-100', 'promo-200', 'promo-eb10', 'promo-op10', 'promo-op20', 'promo-prb10', 'promo-st10'])
T, M = 42, 6   # accept cost <= T; reject if another listing with a different price is within M (visually tuned 2026-09-26)


def parse(page, t):
    out = []
    for m in re.finditer(r'<div\s+class="card-product position-relative mt-4\s*([^"]*)">(.*?)(?=<div\s+class="card-product position-relative|$)', t, re.S):
        blk, sold = m.group(2), 'sold-out' in m.group(1)
        im = re.search(r'card\.yuyu-tei\.jp/opc/100_140/([^/]+)/(\d+)\.jpg" alt="([^"]*)"', blk)
        num = re.search(r'text-center my-2">([^<]*)</span>', blk)
        pr = re.search(r'<strong[^>]*>\s*([\d,]+)\s*円', blk)
        st = re.search(r'在庫 :\s*([^<]*?)\s*</label>', blk)
        if not (im and num and pr): continue
        stock = st.group(1).strip() if st else ''
        out.append({'ver': im.group(1), 'cid': im.group(2), 'alt': html.unescape(im.group(3)), 'num': num.group(1).strip(),
                    'jpy': int(pr.group(1).replace(',', '')), 'in_stock': (not sold) and stock not in ('×', ''), 'stock': stock})
    return out



def main():
    os.makedirs(os.path.join(CACHE, 'y'), exist_ok=True); os.makedirs(os.path.join(CACHE, 'b'), exist_ok=True)
    prev = {}
    if os.path.exists(OUT):
        try: prev = json.load(open(OUT))
        except Exception: pass
    prev_pages = prev.get('pages', {})
    listings, failed, pages = {}, [], {}
    for p in PAGES:
        rows = []
        for attempt in range(3):                      # yuyu-tei sometimes returns a short page
            t = get(f'https://yuyu-tei.jp/sell/opc/s/{p}')
            rows = parse(p, t) if t else []
            if rows or (t and 'card-product' not in t): break
            time.sleep(5 * (attempt + 1))
        pages[p] = len(rows)
        if not rows and prev_pages.get(p): failed.append(p)   # had listings last run, none now
        for o in rows: listings[(o['ver'], o['cid'])] = o
        time.sleep(1.5)
    listings = [o for o in listings.values() if re.match(r'^[A-Z]{1,4}\d{0,2}-\d{3}$', o['num'])]
    prev_n = prev.get('listings', 0)
    if len(listings) < 1000 or failed or (prev_n and len(listings) < 0.95 * prev_n):
        sys.exit(f'Incomplete fetch ({len(listings)} listings vs {prev_n} last time; failed pages: {failed}). Keeping {OUT}')
    nums = {o['num'] for o in listings}
    cache = json.load(open(os.path.join(ROOT, 'data', 'onepiece-cache.json')))
    versions = {}
    for cs in cache['sets'].values():
        for x in cs:
            # JP image only: yuyu-tei sells Japanese prints; EN-only versions (e.g. OP13-031_p1)
            # share the art but not the price, so they must not borrow a JP listing
            img = x.get('img'); u = img.get('jp') if isinstance(img, dict) else img
            if x.get('officialId') and u and u.startswith('http') and x['id'] in nums: versions[x['officialId']] = (x['id'], u)
    from concurrent.futures import ThreadPoolExecutor
    jobs = [(f"https://card.yuyu-tei.jp/opc/100_140/{o['ver']}/{o['cid']}.jpg", os.path.join(CACHE, 'y', f"{o['ver']}_{o['cid']}.jpg")) for o in listings]
    jobs += [(f"https://wsrv.nl/?url={quote(u.replace('https://', ''), safe='/')}&w=120", os.path.join(CACHE, 'b', f'{oid}.jpg')) for oid, (_, u) in versions.items()]
    with ThreadPoolExecutor(8) as ex: list(ex.map(lambda j: fetch_img(*j), jobs))
    Y = collections.defaultdict(list)
    for o in listings:
        f = os.path.join(CACHE, 'y', f"{o['ver']}_{o['cid']}.jpg")
        try: o['f'] = feat(f); Y[o['num']].append(o)
        except Exception: pass
    V = collections.defaultdict(list)
    for oid, (num, _) in versions.items():
        try: V[num].append((oid, feat(os.path.join(CACHE, 'b', f'{oid}.jpg'))))
        except Exception: pass
    res, st, review = {}, collections.Counter(), {}
    def candidates(vf, ys):  # for the admin review queue: closest listings first
        return [{'yyt': f"{y['ver']}/{y['cid']}", 'jpy': y['jpy'], 'in_stock': y['in_stock'], 'alt': y['alt'], 'c': round(cost(vf, y['f']), 1)}
                for y in sorted(ys, key=lambda y: cost(vf, y['f']))[:4]]
    for num, vs in V.items():
        ys = Y.get(num, [])
        pairs = sorted((cost(vf, y['f']), oid, i) for oid, vf in vs for i, y in enumerate(ys))
        used, taken = {}, set()
        for c, oid, i in pairs:                       # one listing per version
            if oid in used or i in taken or c > T: continue
            used[oid] = (c, i); taken.add(i)
        feats = dict(vs)
        for oid, vf in vs:
            if oid not in used:                       # identical-art reprint inherits its twin's listing
                twin = min(((cost(vf, feats[o2]), o2) for o2 in used), default=None)
                if not (twin and twin[0] < 6):
                    st['unmatched'] += 1; review[oid] = candidates(vf, ys); continue
                used[oid] = used[twin[1]]
            c, i = used[oid]; y = ys[i]
            rivals = [cost(vf, ys[j]['f']) for j in range(len(ys)) if j != i and ys[j]['jpy'] != y['jpy']]
            if rivals and min(rivals) - c < M:
                st['ambiguous'] += 1; review[oid] = candidates(vf, ys); continue
            st['matched'] += 1
            res[oid] = {k: y[k] for k in ('jpy', 'in_stock', 'stock', 'alt')} | {'yyt': f"{y['ver']}/{y['cid']}", 'c': round(c, 1)}
    # Gold/silver tie-break: the photos differ only by foil tint. If two unresolved versions
    # of a card number both sit closest to a 金パラレル and a 銀パラレル listing, the warmer
    # Bandai image is the gold one (verified on OP05-119_p7 gold / _p6 silver).
    byNumRev = collections.defaultdict(list)
    for oid in review: byNumRev[versions[oid][0]].append(oid)
    for num, oids in byNumRev.items():
        gold = [y for y in Y.get(num, []) if '金パラレル' in y['alt']]
        silver = [y for y in Y.get(num, []) if '銀パラレル' in y['alt']]
        if len(oids) != 2 or len(gold) != 1 or len(silver) != 1: continue
        w = sorted((warmth(os.path.join(CACHE, 'b', f'{o}.jpg')), o) for o in oids)
        if w[1][0] - w[0][0] < 15: continue
        for (_, oid), y in ((w[1], gold[0]), (w[0], silver[0])):
            res[oid] = {k: y[k] for k in ('jpy', 'in_stock', 'stock', 'alt')} | {'yyt': f"{y['ver']}/{y['cid']}", 'c': None, 'rule': 'gold-silver'}
            review.pop(oid, None); st['gold-silver'] += 1
    json.dump({'date': datetime.date.today().isoformat(), 'listings': len(listings), 'pages': pages, 'versions': res, 'review': review}, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f"{len(listings)} listings, {len(versions)} versions -> {dict(st)} -> {OUT}")

if __name__ == '__main__':
    main()
