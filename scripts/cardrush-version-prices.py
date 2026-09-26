#!/usr/bin/env python3
"""Per-version One Piece prices from Card Rush — second exact source after yuyu-tei (#78).

Only card numbers that still have a parallel without an exact price are searched
(~320 on 2026-09-27), politely, one request every ~2 s. Listings for damaged (〔状態…〕)
or graded (〔PSA…〕 / 鑑定済) copies are ignored: prices are for normal near-mint cards.
Each remaining listing photo is matched to Bandai's JP image per version (one listing
per version, rival-price margin), exactly like scripts/yuyutei-version-prices.py.

Writes data/prices/onepiece-versions-cardrush.json {date, versions:{officialId:{jpy,in_stock,stock,name,c}}}
Usage: python3 scripts/cardrush-version-prices.py [--all]   (--all = every card number, ~1.5 h)
"""
import json, os, re, sys, html, time, datetime, collections
from urllib.parse import quote_plus
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from version_match import get, fetch_img, feat, cost

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CACHE = os.path.join(ROOT, 'data', '.cache', 'cr')
OUT = os.path.join(ROOT, 'data', 'prices', 'onepiece-versions-cardrush.json')
YYT = os.path.join(ROOT, 'data', 'prices', 'onepiece-versions.json')
T, M = 42, 6

def parse(t):
    out = []
    for b in re.findall(r'<li class="list_item_cell.*?</li>', t, re.S):
        alt = re.search(r'<img src="([^"]+)"[^>]*alt="([^"]+)"', b)
        pr = re.search(r'class="figure">([\d,]+)円', b)
        st = re.search(r'class="stock">([^<]*)<', b)
        pid = re.search(r'data-product-id="(\d+)"', b)
        if not (alt and pr and pid): continue
        name = html.unescape(alt.group(2))
        if re.search(r'〔[^〕]*(状態|PSA|BGS|CGC|ARS|鑑定)[^〕]*〕', name): continue   # not a normal NM copy
        stock = (st.group(1).strip() if st else '')
        out.append({'pid': pid.group(1), 'img': alt.group(1), 'name': name, 'jpy': int(pr.group(1).replace(',', '')),
                    'in_stock': 'soldout' not in b and '在庫なし' not in stock, 'stock': stock})
    return out

def main():
    os.makedirs(CACHE, exist_ok=True)
    cache = json.load(open(os.path.join(ROOT, 'data', 'onepiece-cache.json')))
    exact = json.load(open(YYT)).get('versions', {}) if os.path.exists(YYT) else {}
    byNum = collections.defaultdict(dict)
    for cs in cache['sets'].values():
        for x in cs:
            img = x.get('img'); u = img.get('jp') if isinstance(img, dict) else img
            if x.get('officialId') and u and u.startswith('http'): byNum[x['id']][x['officialId']] = (x.get('finish', ''), u)
    regular_price = {x['id']: (x.get('pricing') or {}).get('computed', {}).get('jpy')
                     for cs in cache['sets'].values() for x in cs if x.get('finish') == 'regular' and x.get('officialId') == x['id']}
    todo = [n for n, vs in byNum.items() if '--all' in sys.argv or
            any(f.startswith('parallel') and oid not in exact for oid, (f, _) in vs.items())]
    if '--num' in sys.argv: todo = sys.argv[sys.argv.index('--num') + 1].split(',')   # test a few numbers
    print(f'{len(todo)} card numbers to look up')
    res, st, fails = {}, collections.Counter(), 0
    for k, num in enumerate(sorted(todo)):
        t = get(f'https://www.cardrush-op.jp/product-list?keyword={quote_plus(num)}')
        time.sleep(2)
        if t is None:
            fails += 1
            if fails > 20: sys.exit('Card Rush keeps failing — stopping, keeping the last file')
            continue
        listings = [o for o in parse(t) if '{' + num + '}' in o['name'] or num in o['name']]
        ys = []
        for o in listings:
            f = os.path.join(CACHE, f"{o['pid']}.jpg")
            if fetch_img(o['img'], f):
                try: o['f'] = feat(f, crop=True); ys.append(o)
                except Exception: pass
        vs = []
        for oid, (_, u) in byNum[num].items():
            f = os.path.join(ROOT, 'data', '.cache', 'yv', 'b', f'{oid}.jpg')
            if not fetch_img(f"https://wsrv.nl/?url={quote_plus(u.replace('https://', ''))}&w=120", f): continue
            try: vs.append((oid, feat(f)))
            except Exception: pass
        pairs = sorted((cost(vf, y['f']), oid, i) for oid, vf in vs for i, y in enumerate(ys))
        used, taken = {}, set()
        for c, oid, i in pairs:                     # one listing per version, all versions compete
            if oid in used or i in taken or c > T: continue
            used[oid] = (c, i); taken.add(i)
        for oid, vf in vs:
            if oid not in used: st['unmatched'] += 1; continue
            c, i = used[oid]; y = ys[i]
            rivals = [cost(vf, ys[j]['f']) for j in range(len(ys)) if j != i and ys[j]['jpy'] != y['jpy']]
            if rivals and min(rivals) - c < M: st['ambiguous'] += 1; continue
            st['matched'] += 1
            res[oid] = {'jpy': y['jpy'], 'in_stock': y['in_stock'], 'stock': y['stock'], 'name': y['name'], 'pid': y['pid'], 'c': round(c, 1)}
        # Guard: a parallel often shares the regular card's art (only the foil differs), so the
        # photo match can land on the regular listing. A parallel that isn't dearer than the
        # regular version of the same card number is rejected (checked visually 2026-09-27).
        reg = res.get(num)
        reg_jpy = reg['jpy'] if reg else regular_price.get(num)   # else the regular's known price
        for oid in [o for o in list(res) if o.startswith(num + '_p')]:
            if (reg and res[oid]['pid'] == reg['pid']) or (reg_jpy and res[oid]['jpy'] <= reg_jpy):
                del res[oid]; st['matched'] -= 1; st['rejected: not dearer than regular'] += 1
        if k % 25 == 0: print(f'  {k}/{len(todo)} {dict(st)}', flush=True)
    if '--num' in sys.argv:
        print(json.dumps(res, ensure_ascii=False, indent=1)); return
    json.dump({'date': datetime.date.today().isoformat(), 'numbers': len(todo), 'versions': res}, open(OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(f'{dict(st)} -> {OUT}')

if __name__ == '__main__':
    main()
