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

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CACHE = os.path.join(ROOT, 'data', '.cache', 'yv')
OUT = os.path.join(ROOT, 'data', 'prices', 'onepiece-versions.json')
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
PAGES = ([f'op{i:02d}' for i in range(1, 19)] + [f'eb{i:02d}' for i in range(1, 6)] + ['prb01', 'prb02'] +
         [f'st{i:02d}' for i in range(1, 40)] + ['promo-100', 'promo-200', 'promo-eb10', 'promo-op10', 'promo-op20', 'promo-prb10', 'promo-st10'])
T, M = 42, 6   # accept cost <= T; reject if another listing with a different price is within M (visually tuned 2026-09-26)

def get(url, binary=False):
    for _ in range(3):
        try:
            data = urlopen(Request(url, headers=UA), timeout=30).read()
            return data if binary else data.decode('utf-8', 'ignore')
        except Exception:
            time.sleep(2)
    return None

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

def feat(p):
    im = Image.open(p).convert('RGB').resize((100, 140))
    g = list(im.convert('L').resize((25, 24)).getdata())
    return [g[r * 25 + c] > g[r * 25 + c + 1] for r in range(24) for c in range(24)], list(im.resize((5, 7)).getdata())

def cost(a, b):
    hd = sum(x != y for x, y in zip(a[0], b[0]))
    cd = sum(abs(p[i] - q[i]) for p, q in zip(a[1], b[1]) for i in range(3)) / (35 * 3)
    return hd / 576 * 100 + cd * 0.6

def fetch_img(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 500: return True
    data = get(url, binary=True)
    if data and len(data) > 500:
        open(path, 'wb').write(data); return True
    return False

def main():
    os.makedirs(os.path.join(CACHE, 'y'), exist_ok=True); os.makedirs(os.path.join(CACHE, 'b'), exist_ok=True)
    listings = {}
    for p in PAGES:
        t = get(f'https://yuyu-tei.jp/sell/opc/s/{p}')
        if not t: continue
        for o in parse(p, t): listings[(o['ver'], o['cid'])] = o
        time.sleep(0.5)
    listings = [o for o in listings.values() if re.match(r'^[A-Z]{1,4}\d{0,2}-\d{3}$', o['num'])]
    if len(listings) < 1000:
        sys.exit(f'Only {len(listings)} listings parsed — yuyu-tei layout changed? Not overwriting {OUT}')
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
    res, st = {}, collections.Counter()
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
                if not (twin and twin[0] < 6): st['unmatched'] += 1; continue
                used[oid] = used[twin[1]]
            c, i = used[oid]; y = ys[i]
            rivals = [cost(vf, ys[j]['f']) for j in range(len(ys)) if j != i and ys[j]['jpy'] != y['jpy']]
            if rivals and min(rivals) - c < M: st['ambiguous'] += 1; continue
            st['matched'] += 1
            res[oid] = {k: y[k] for k in ('jpy', 'in_stock', 'stock', 'alt')} | {'yyt': f"{y['ver']}/{y['cid']}", 'c': round(c, 1)}
    json.dump({'date': datetime.date.today().isoformat(), 'versions': res}, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f"{len(listings)} listings, {len(versions)} versions -> {dict(st)} -> {OUT}")

if __name__ == '__main__':
    main()
