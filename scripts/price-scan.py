#!/usr/bin/env python3
"""Regional Price Scanner v2 — multi-source JP pricing authority.

Writes to: data/prices/onepiece-current.json (separated from card metadata)
Sources: Surugaya, Yuyutei (sell+buy), Card Rush, Hareruya

Usage:
  python3 scripts/price-scan.py --card PRB02-017
  python3 scripts/price-scan.py --set PRB-02 --limit 10
  python3 scripts/price-scan.py --set PRB-02
  python3 scripts/price-scan.py --dry-run
"""

import json, re, os, sys, time, argparse, random
from urllib.request import Request, urlopen
from urllib.parse import quote_plus
from datetime import date
from math import log, exp

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, '..', 'data')
CACHE_FILE = os.path.join(DATA_DIR, 'onepiece-cache.json')
PRICES_FILE = os.path.join(DATA_DIR, 'prices', 'onepiece-current.json')
HISTORY_DIR = os.path.join(DATA_DIR, 'prices', 'history')
SOURCES_FILE = os.path.join(DATA_DIR, 'pricing-sources.json')

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
MAX_RETRIES = 3

def _fetch(url, delay_range=(2.0, 4.0)):
    """Fetch URL with random delay, retry, and backoff."""
    for attempt in range(MAX_RETRIES):
        try:
            time.sleep(random.uniform(*delay_range))
            req = Request(url, headers={'User-Agent': UA, 'Accept-Language': 'ja-JP'})
            return urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                time.sleep(2 ** attempt)
            else:
                raise e

# --- Scrapers ---

def search_surugaya(card_id):
    """Surugaya: multi-store marketplace. Embedded JS data."""
    url = f"https://www.suruga-ya.jp/search?category=&search_word={quote_plus(card_id)}&restrict%5B%5D=categorygroup_6"
    try:
        html = _fetch(url)
    except Exception as e:
        return {'error': str(e)}

    items = re.findall(
        r"item_id:\s*common\.htmlDecode\('([^']+)'\).*?"
        r"item_name:\s*common\.htmlDecode\('([^']+)'\).*?"
        r"price:\s*(\d+)",
        html, re.DOTALL
    )
    results = []
    for item_id, name, price in items:
        p = int(price)
        if p < 30 or not name.startswith(card_id):
            continue
        is_parallel = 'パラレル' in name
        results.append({'price': p, 'name': name[:80], 'url': f"https://www.suruga-ya.jp/product/detail/{item_id}",
                       'variant': 'parallel' if is_parallel else 'normal'})
    return {'results': results, 'source': 'surugaya'}


def search_yuyutei(card_id):
    """Yuyutei: single-price retailer. Captures sell price. Buy price from separate page."""
    url = f"https://yuyu-tei.jp/sell/opc/s/search?search_word={quote_plus(card_id)}"
    try:
        html = _fetch(url)
    except Exception as e:
        return {'error': str(e)}

    # Sell prices
    pattern = (
        r'<span[^>]*class="d-block border[^"]*"[^>]*>\s*' + re.escape(card_id) + r'\s*</span>'
        r'.*?<h4[^>]*>([^<]+)</h4>\s*</a>\s*<strong[^>]*>\s*(\d+)\s*円'
    )
    results = []
    for match in re.finditer(pattern, html, re.DOTALL):
        name, price = match.groups()
        name = name.strip()
        is_parallel = 'パラレル' in name or 'スーパーパラレル' in name
        results.append({'price': int(price), 'name': name, 'variant': 'parallel' if is_parallel else 'normal',
                       'type': 'sell', 'url': url})

    # Buy prices (separate URL)
    buy_url = f"https://yuyu-tei.jp/buy/opc/s/search?search_word={quote_plus(card_id)}"
    try:
        buy_html = _fetch(buy_url, delay_range=(1.5, 3.0))
        for match in re.finditer(pattern.replace('/sell/', '/buy/'), buy_html, re.DOTALL):
            name, price = match.groups()
            name = name.strip()
            is_parallel = 'パラレル' in name
            results.append({'price': int(price), 'name': name, 'variant': 'parallel' if is_parallel else 'normal',
                           'type': 'buy', 'url': buy_url})
    except:
        pass  # buy page may not exist for all cards

    return {'results': results, 'source': 'yuyutei'}


def search_cardrush(card_id):
    """Card Rush: specialist OP retailer."""
    url = f"https://www.cardrush-op.jp/product-list?keyword={quote_plus(card_id)}"
    try:
        html = _fetch(url)
    except Exception as e:
        return {'error': str(e)}

    raw = re.findall(
        r'href="(https?://www\.cardrush-op\.jp/product/\d+)"[^>]*>\s*'
        r'(?:<[^>]*>)*\s*(.*?)(\d{1,3}(?:,\d{3})*)円',
        html, re.DOTALL
    )
    parallel_markers = ['パラレル', 'PARALLEL', 'コミック', 'MANGA', 'シークレット', 'SECRET',
                        'SP', 'スペシャル', 'ホイル', 'FOIL', 'プレミアム']
    results = []
    for link, content, price in raw:
        texts = [t.strip() for t in re.findall(r'>([^<]+)<', content) if t.strip()]
        title = ' '.join(texts)[:100]
        if card_id.upper() not in title.upper().replace(' ', '').replace('　', ''):
            continue
        p = int(price.replace(',', ''))
        if p < 30 or 'デッキ' in title or '品切れ' in title or 'SOLDOUT' in title.upper():
            continue
        is_parallel = any(m in title for m in parallel_markers)
        results.append({'price': p, 'name': title, 'url': link,
                       'variant': 'parallel' if is_parallel else 'normal'})
    return {'results': results, 'source': 'cardrush'}


def search_hareruya(card_id):
    """Hareruya: major JP retailer."""
    url = f"https://www.hareruyamtg.com/ja/products/search?keyword={quote_plus(card_id)}&category=onepiece"
    try:
        html = _fetch(url)
    except Exception as e:
        return {'error': str(e)}

    # Hareruya: product cards with price
    results = []
    # Pattern: product name containing card ID + price
    blocks = re.findall(r'<div[^>]*class="[^"]*product[^"]*"[^>]*>(.*?)</div>\s*</div>', html, re.DOTALL)
    # Fallback: find prices near card ID
    pattern = r'(' + re.escape(card_id) + r'[^<]*)<.*?(\d{1,3}(?:,\d{3})*)\s*円'
    for match in re.finditer(pattern, html, re.DOTALL):
        name, price = match.groups()
        p = int(price.replace(',', ''))
        if p < 30:
            continue
        is_parallel = 'パラレル' in name
        results.append({'price': p, 'name': name.strip()[:80], 'url': url,
                       'variant': 'parallel' if is_parallel else 'normal'})

    return {'results': results, 'source': 'hareruya'}


# --- Price Computation ---

RANKS = {'surugaya': 1, 'yuyutei': 1.5, 'cardrush': 3, 'hareruya': 2, 'mercari': 4}

def compute_prices(source_data):
    """Compute reference_price and floor_price from source data.
    source_data: {'surugaya': {'sell': 90}, 'yuyutei': {'sell': 220, 'buy': 150}, ...}
    """
    sell_prices = {src: d['sell'] for src, d in source_data.items() if d.get('sell')}
    buy_prices = {src: d['buy'] for src, d in source_data.items() if d.get('buy')}

    if not sell_prices:
        return None

    # Reference price: volume-adjusted weighted average
    weighted_sum = 0
    weight_total = 0
    for src, price in sell_prices.items():
        rank = RANKS.get(src, 5)
        listings = source_data[src].get('listings', 1)
        weight = (1.0 / rank) * log(1 + listings)
        weighted_sum += price * weight
        weight_total += weight

    reference_price = round(weighted_sum / weight_total) if weight_total else None
    floor_price = min(sell_prices.values())
    buy_price = max(buy_prices.values()) if buy_prices else None

    # Confidence: 0-1 numeric
    n_sources = len(sell_prices)
    confidence = min(1.0, n_sources / 3)

    return {
        'reference': reference_price,
        'floor': floor_price,
        'buy': buy_price,
        'spread_pct': round((reference_price - buy_price) / reference_price * 100, 1) if buy_price and reference_price else None,
        'sources_count': n_sources,
        'confidence': round(confidence, 2)
    }


# --- Main ---

def scan_card(card_id, sources_to_use=None):
    """Scan one card across all JP sources. Returns structured pricing."""
    scanners = {
        'surugaya': search_surugaya,
        'yuyutei': search_yuyutei,
        'cardrush': search_cardrush,
        # 'hareruya': search_hareruya,  # JS-rendered, needs Puppeteer
    }
    if sources_to_use:
        scanners = {k: v for k, v in scanners.items() if k in sources_to_use}

    today = date.today().isoformat()
    variants = {}  # {'normal': {src: {sell, buy, listings}}, 'parallel': {...}}

    for src_name, search_fn in sorted(scanners.items(), key=lambda x: RANKS.get(x[0], 99)):
        result = search_fn(card_id)
        if 'error' in result:
            print(f"  ⚠️  {src_name}: {result['error']}")
            continue

        listings = result.get('results', [])
        if not listings:
            print(f"  ❌ {src_name}: no results")
            continue

        # Group by variant
        for variant_type in ['normal', 'parallel']:
            variant_listings = [r for r in listings if r['variant'] == variant_type]
            if not variant_listings:
                continue

            if variant_type not in variants:
                variants[variant_type] = {}
            if src_name not in variants[variant_type]:
                variants[variant_type][src_name] = {}

            # Separate sell vs buy (yuyutei has both)
            sell_listings = [r for r in variant_listings if r.get('type', 'sell') == 'sell']
            buy_listings = [r for r in variant_listings if r.get('type') == 'buy']

            if sell_listings:
                floor = min(r['price'] for r in sell_listings)
                variants[variant_type][src_name]['sell'] = floor
                variants[variant_type][src_name]['listings'] = len(sell_listings)
            if buy_listings:
                best_buy = max(r['price'] for r in buy_listings)
                variants[variant_type][src_name]['buy'] = best_buy

        # Print summary
        normal = [r for r in listings if r['variant'] == 'normal' and r.get('type', 'sell') == 'sell']
        parallel = [r for r in listings if r['variant'] == 'parallel' and r.get('type', 'sell') == 'sell']
        buy = [r for r in listings if r.get('type') == 'buy' and r['variant'] == 'normal']
        parts = []
        if normal: parts.append(f"¥{min(r['price'] for r in normal)}")
        if buy: parts.append(f"buy ¥{max(r['price'] for r in buy)}")
        if parallel: parts.append(f"parallel ¥{min(r['price'] for r in parallel)}")
        print(f"  ✅ {src_name}: {' | '.join(parts)} ({len(listings)} listings)")

    # Compute prices per variant
    result = {'variants': {}, 'updated': today}
    for variant_type, source_data in variants.items():
        computed = compute_prices(source_data)
        if computed:
            result['variants'][variant_type] = {
                'sources': {src: d for src, d in source_data.items()},
                'reference': computed['reference'],
                'floor': computed['floor'],
                'buy': computed['buy'],
                'spread_pct': computed['spread_pct'],
                'confidence': computed['confidence'],
                'sources_count': computed['sources_count']
            }

    return result


def main():
    parser = argparse.ArgumentParser(description='Regional Price Scanner v2')
    parser.add_argument('--set', help='Scan specific set')
    parser.add_argument('--card', help='Scan specific card')
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--source', help='Only use specific source')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--min-value', type=int, default=0, help='Only scan cards worth >= this')
    args = parser.parse_args()

    # Load prices file
    os.makedirs(os.path.dirname(PRICES_FILE), exist_ok=True)
    if os.path.exists(PRICES_FILE):
        with open(PRICES_FILE) as f:
            price_data = json.load(f)
    else:
        price_data = {'_meta': {'schema_version': '2.0'}, 'prices': {}}

    sources_to_use = [args.source] if args.source else None
    scanned = 0
    updated = 0
    today = date.today().isoformat()

    if args.card:
        print(f"🔍 Scanning {args.card}...")
        result = scan_card(args.card, sources_to_use)
        for vtype, vdata in result.get('variants', {}).items():
            print(f"\n  📊 {vtype}: ref ¥{vdata['reference']} | floor ¥{vdata['floor']} | buy ¥{vdata.get('buy', '?')} | confidence {vdata['confidence']}")
        if not args.dry_run and result['variants']:
            price_data['prices'][args.card] = result
            updated = 1
        scanned = 1
    else:
        # Bulk mode: get card list from cache
        with open(CACHE_FILE) as f:
            cache = json.load(f)

        target_sets = [args.set] if args.set else list(cache['sets'].keys())
        cards_to_scan = []
        for sid in target_sets:
            if sid not in cache['sets']:
                continue
            seen = set()
            for card in cache['sets'][sid]:
                cid = card.get('id', '')
                if cid in seen or not cid:
                    continue
                seen.add(cid)
                # Get current price from prices file
                current = price_data.get('prices', {}).get(cid, {})
                current_ref = (current.get('variants', {}).get('normal', {}).get('reference') or
                              current.get('variants', {}).get('normal', {}).get('sources', {}).get('rarity', {}).get('sell') or 0)
                # Also check old inline computed price
                if not current_ref:
                    old = current.get('variants', {}).get('normal', {}).get('computed', {}).get('jpy', 0)
                    current_ref = old
                if current_ref >= args.min_value:
                    cards_to_scan.append((sid, cid, current_ref))

        cards_to_scan.sort(key=lambda x: -x[2])
        if args.limit:
            cards_to_scan = cards_to_scan[:args.limit]

        print(f"📋 Scanning {len(cards_to_scan)} cards from {len(target_sets)} set(s)...\n")

        fail_count = 0
        for sid, cid, current_ref in cards_to_scan:
            print(f"[{scanned+1}/{len(cards_to_scan)}] {cid} (current ref: ¥{current_ref})")
            result = scan_card(cid, sources_to_use)
            scanned += 1

            if result['variants']:
                normal = result['variants'].get('normal', {})
                if normal:
                    ref = normal.get('reference', 0)
                    diff = ref - current_ref if current_ref else 0
                    arrow = '↑' if diff > 0 else '↓' if diff < 0 else '='
                    print(f"  → ref ¥{ref} ({arrow}{abs(diff)}) | floor ¥{normal.get('floor','?')} | conf {normal.get('confidence','?')}\n")
                if not args.dry_run:
                    price_data['prices'][cid] = result
                    updated += 1
                fail_count = 0
            else:
                fail_count += 1
                print()
                # Breakage detection
                if fail_count >= 5 and scanned > 5:
                    print("⚠️  5 consecutive failures — possible scraper breakage. Stopping.")
                    break

    # Save
    if not args.dry_run and updated > 0:
        price_data['_meta']['updated'] = today
        price_data['_meta']['total_cards'] = len(price_data['prices'])
        with open(PRICES_FILE, 'w') as f:
            json.dump(price_data, f, ensure_ascii=False, separators=(',', ':'))
        print(f"\n💾 Saved {updated} cards to {PRICES_FILE}")

        # Append to daily history
        os.makedirs(HISTORY_DIR, exist_ok=True)
        history_file = os.path.join(HISTORY_DIR, f"{today}.jsonl")
        with open(history_file, 'a') as f:
            for cid in list(price_data['prices'].keys())[-updated:]:
                entry = {'card': cid, 'data': price_data['prices'][cid]}
                f.write(json.dumps(entry, ensure_ascii=False) + '\n')

    print(f"\n✅ Done. Scanned: {scanned}, Updated: {updated}")


if __name__ == '__main__':
    main()
