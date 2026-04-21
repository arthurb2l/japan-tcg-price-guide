#!/usr/bin/env python3
"""Variant Image Verifier — downloads Bandai + Card Rush images for visual comparison.

Usage:
  python3 scripts/verify-variant-images.py OP01-120
  python3 scripts/verify-variant-images.py --top 20   # top 20 most expensive unverified cards
  python3 scripts/verify-variant-images.py --apply     # apply verified mappings to DB
"""

import json, re, os, sys, time, argparse
from urllib.request import Request, urlopen
from urllib.parse import quote_plus

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, '..', 'data')
CACHE_FILE = os.path.join(DATA_DIR, 'onepiece-cache.json')
MAP_FILE = os.path.join(DATA_DIR, 'variant-image-map.json')
VERIFY_DIR = '/tmp/card-verify'
BANDAI_JP = "https://www.onepiece-cardgame.com/images/cardlist/card/"
BANDAI_EN = "https://en.onepiece-cardgame.com/images/cardlist/card/"
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'


def fetch_image(url, path):
    """Download image to path. Returns True if successful."""
    try:
        req = Request(url, headers={'User-Agent': UA})
        data = urlopen(req, timeout=15).read()
        with open(path, 'wb') as f:
            f.write(data)
        return True
    except:
        return False


def probe_bandai_variants(card_id):
    """Probe Bandai JP+EN for all variant images. Returns {suffix: url}."""
    found = {}
    for suffix in ['', '_p1', '_p2', '_p3', '_p4', '_p5', '_p6', '_p7', '_p8', '_r1', '_r2']:
        for base_url in [BANDAI_JP, BANDAI_EN]:
            url = f"{base_url}{card_id}{suffix}.png"
            try:
                req = Request(url, method='HEAD', headers={'User-Agent': UA})
                resp = urlopen(req, timeout=10)
                if resp.status == 200:
                    found[suffix or 'base'] = url
                    break
            except:
                pass
            time.sleep(0.2)
    return found


def fetch_cardrush_variants(card_id):
    """Get Card Rush listings with images and variant descriptions."""
    url = f"https://www.cardrush-op.jp/product-list?keyword={quote_plus(card_id)}"
    try:
        html = urlopen(Request(url, headers={'User-Agent': UA}), timeout=15).read().decode('utf-8', errors='ignore')
    except:
        return []

    pattern = r'data-product-id="(\d+)".*?<img[^>]*src="([^"]+)"[^>]*data-x2="([^"]+)"[^>]*alt="([^"]*)".*?(\d{1,3}(?:,\d{3})*)円'
    matches = re.findall(pattern, html, re.DOTALL)

    results = []
    seen = set()
    for pid, img_sm, img_lg, alt, price in matches:
        if card_id not in alt:
            continue
        # Skip graded and poor condition
        if any(m in alt for m in ['鑑定済', 'PSA', 'BGS', 'CGC', 'ARS', 'ACE']):
            continue
        if '状態B' in alt or '状態C' in alt or '状態D' in alt or '状態難' in alt:
            continue

        # Classify
        if 'シリアル' in alt:
            vtype = 'serial'
        elif '漫画背景' in alt:
            vtype = 'manga_sp'
        elif '海賊旗' in alt or ('背景' in alt and '漫画' not in alt):
            vtype = 'parallel_theme'
        elif 'パラレル' in alt and 'illust:' in alt.lower():
            vtype = 'parallel'
        elif 'パラレル' in alt:
            vtype = 'parallel_other'
        else:
            vtype = 'normal'

        if vtype not in seen:
            seen.add(vtype)
            results.append({
                'pid': pid, 'img': img_lg, 'alt': alt[:120],
                'price': int(price.replace(',', '')), 'type': vtype
            })

    return results


def download_for_verification(card_id):
    """Download all images for a card for visual comparison."""
    os.makedirs(VERIFY_DIR, exist_ok=True)
    card_dir = os.path.join(VERIFY_DIR, card_id)
    os.makedirs(card_dir, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"Downloading images for {card_id}")
    print(f"{'='*60}")

    # Bandai images
    print("\nBandai variants:")
    bandai = probe_bandai_variants(card_id)
    for suffix, url in sorted(bandai.items()):
        fname = f"{card_dir}/bandai_{suffix}.png"
        if fetch_image(url, fname):
            size = os.path.getsize(fname)
            print(f"  ✅ {suffix}: {size:,} bytes → {fname}")
        time.sleep(0.3)

    # Card Rush images
    print("\nCard Rush variants:")
    cardrush = fetch_cardrush_variants(card_id)
    time.sleep(2)
    for cr in cardrush:
        fname = f"{card_dir}/cardrush_{cr['type']}.jpg"
        if fetch_image(cr['img'], fname):
            print(f"  ✅ {cr['type']}: ¥{cr['price']:,} | {cr['alt'][:60]}")
        time.sleep(0.3)

    print(f"\nImages saved to: {card_dir}/")
    print(f"Bandai: {len(bandai)} variants")
    print(f"Card Rush: {len(cardrush)} variants")
    print(f"\nVisual comparison needed:")
    print(f"  Compare bandai_*.png with cardrush_*.jpg")
    print(f"  Then add mapping to {MAP_FILE}")

    return bandai, cardrush


def apply_mappings():
    """Apply verified mappings from variant-image-map.json to the DB."""
    with open(CACHE_FILE) as f:
        cache = json.load(f)
    with open(MAP_FILE) as f:
        vmap = json.load(f)

    mappings = vmap.get('mappings', {})
    fixed = 0

    for sid, cards in cache['sets'].items():
        for card in cards:
            cid = card.get('id', '')
            if cid not in mappings:
                continue

            oid = card.get('officialId', '')
            finish = card.get('finish', 'regular')

            # Find which _pN suffix this card uses
            suffix = None
            if oid and '_p' in oid:
                suffix = '_p' + oid.split('_p')[-1]
            elif oid and '_r' in oid:
                suffix = '_r' + oid.split('_r')[-1]
            elif finish == 'regular':
                suffix = 'base'

            if suffix and suffix in mappings[cid]:
                variant_info = mappings[cid][suffix]
                # Set correct image
                bandai_variants = probe_bandai_variants(cid) if suffix not in ['base'] else {}
                # Use the Bandai URL for this suffix
                for base_url in [BANDAI_JP, BANDAI_EN]:
                    img_url = f"{base_url}{cid}{suffix if suffix != 'base' else ''}.png"
                    try:
                        req = Request(img_url, method='HEAD', headers={'User-Agent': UA})
                        resp = urlopen(req, timeout=10)
                        if resp.status == 200:
                            if isinstance(card.get('img'), dict):
                                card['img']['jp'] = img_url
                            else:
                                card['img'] = img_url
                            card['_image_verified'] = True
                            card['_variant_type'] = variant_info['type']
                            card.pop('_image_fallback', None)
                            fixed += 1
                            break
                    except:
                        pass
                    time.sleep(0.1)

    with open(CACHE_FILE, 'w') as f:
        json.dump(cache, f, ensure_ascii=False, separators=(',', ':'))
    print(f"Applied verified mappings to {fixed} cards")


def find_unverified_expensive():
    """Find most expensive cards that haven't been verified yet."""
    with open(CACHE_FILE) as f:
        cache = json.load(f)
    with open(MAP_FILE) as f:
        vmap = json.load(f)

    verified_ids = set(vmap.get('mappings', {}).keys())
    candidates = []

    for sid, cards in cache['sets'].items():
        for c in cards:
            cid = c.get('id', '')
            finish = c.get('finish', '')
            if cid in verified_ids or 'parallel' not in finish:
                continue
            jpy = c.get("pricing", {}).get("computed", {}).get("jpy") or 0
            if jpy > 0:
                candidates.append((jpy, cid, finish, sid))

    # Deduplicate by card ID, keep highest price
    seen = {}
    for jpy, cid, finish, sid in candidates:
        if cid not in seen or jpy > seen[cid][0]:
            seen[cid] = (jpy, finish, sid)

    result = [(jpy, cid, finish, sid) for cid, (jpy, finish, sid) in seen.items()]
    result.sort(reverse=True)
    return result


def main():
    parser = argparse.ArgumentParser(description='Variant Image Verifier')
    parser.add_argument('card_id', nargs='?', help='Card ID to verify')
    parser.add_argument('--top', type=int, help='Download top N unverified expensive cards')
    parser.add_argument('--apply', action='store_true', help='Apply verified mappings to DB')
    parser.add_argument('--list', action='store_true', help='List unverified expensive cards')
    args = parser.parse_args()

    if args.apply:
        apply_mappings()
    elif args.list:
        cards = find_unverified_expensive()
        print(f"Top 30 unverified expensive parallel cards:")
        for jpy, cid, finish, sid in cards[:30]:
            print(f"  ¥{jpy:>8,} | {cid:15} | {finish:12} | {sid}")
    elif args.top:
        cards = find_unverified_expensive()
        for _, cid, _, _ in cards[:args.top]:
            download_for_verification(cid)
            time.sleep(2)
    elif args.card_id:
        download_for_verification(args.card_id)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
