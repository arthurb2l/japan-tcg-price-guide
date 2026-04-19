#!/usr/bin/env python3
"""Regional Price Scanner — fetches prices from JP sources and updates the card DB.

Usage:
  python3 scripts/price-scan.py --card PRB02-017       # scan specific card
  python3 scripts/price-scan.py --set PRB-02 --limit 5 # scan top 5 cards in set
  python3 scripts/price-scan.py --set PRB-02           # scan all cards in set
  python3 scripts/price-scan.py --source yuyutei       # only use one source
  python3 scripts/price-scan.py --dry-run              # don't write to DB
"""

import json, re, os, sys, time, argparse, subprocess
from urllib.request import Request, urlopen
from urllib.parse import quote_plus
from datetime import date

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, '..', 'data')
CACHE_FILE = os.path.join(DATA_DIR, 'onepiece-cache.json')
SOURCES_FILE = os.path.join(DATA_DIR, 'pricing-sources.json')
SCAN_LOG = os.path.join(DATA_DIR, 'price-scan-log.json')

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
DELAY_MS = 2500

# --- Scrapers ---

def search_yuyutei(card_id):
    """Search Yuyutei. Returns {results: [{price, name, variant, url}]}."""
    url = f"https://yuyu-tei.jp/sell/opc/s/search?search_word={quote_plus(card_id)}"
    req = Request(url, headers={'User-Agent': UA})
    try:
        html = urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')
    except Exception as e:
        return {'error': str(e)}

    # Card ID shown in: <span class="...border...">CARD-ID</span>
    # Then: <a href="..."><h4>NAME</h4></a><strong>PRICE 円</strong>
    # Extract all listings with card ID + name + price
    pattern = (
        r'<span[^>]*class="d-block border[^"]*"[^>]*>\s*' + re.escape(card_id) + r'\s*</span>'
        r'.*?<h4[^>]*>([^<]+)</h4>\s*</a>\s*<strong[^>]*>\s*(\d+)\s*円'
    )
    results = []
    for match in re.finditer(pattern, html, re.DOTALL):
        name, price = match.groups()
        name = name.strip()
        is_parallel = 'パラレル' in name or 'スーパーパラレル' in name
        results.append({
            'price': int(price),
            'name': name,
            'variant': 'parallel' if is_parallel else 'normal',
            'url': url
        })

    return {'results': results, 'source': 'yuyutei', 'url': url}


def search_cardrush(card_id):
    """Search Card Rush OP. Returns {results: [{price, name, variant, url}]}."""
    url = f"https://www.cardrush-op.jp/product-list?keyword={quote_plus(card_id)}"
    req = Request(url, headers={'User-Agent': UA})
    try:
        html = urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')
    except Exception as e:
        return {'error': str(e)}

    raw = re.findall(
        r'href="(https?://www\.cardrush-op\.jp/product/\d+)"[^>]*>\s*'
        r'(?:<[^>]*>)*\s*(.*?)(\d{1,3}(?:,\d{3})*)円',
        html, re.DOTALL
    )
    results = []
    parallel_markers = ['パラレル', 'PARALLEL', 'コミック', 'MANGA', 'シークレット', 'SECRET',
                        'SP', 'スペシャル', 'ホイル', 'FOIL', 'プレミアム']
    for link, content, price in raw:
        texts = [t.strip() for t in re.findall(r'>([^<]+)<', content) if t.strip()]
        title = ' '.join(texts)[:100]
        # Must contain the card ID
        if card_id.upper() not in title.upper().replace(' ', '').replace('　', ''):
            continue
        p = int(price.replace(',', ''))
        if p < 30 or 'デッキ' in title or '品切れ' in title or 'SOLDOUT' in title.upper():
            continue
        is_parallel = any(m in title for m in parallel_markers)
        results.append({
            'price': p, 'name': title, 'url': link,
            'variant': 'parallel' if is_parallel else 'normal'
        })

    return {'results': results, 'source': 'cardrush', 'url': url}


def search_mercari(card_id):
    """Search Mercari JP sold listings via Node script. Returns {results: [...]}."""
    script = os.path.join(SCRIPT_DIR, 'fetch-mercari-jp.js')
    if not os.path.exists(script):
        return {'error': 'fetch-mercari-jp.js not found'}
    try:
        result = subprocess.run(
            ['node', '-e', f'''
const puppeteer = require("puppeteer");
(async()=>{{
  const b=await puppeteer.launch({{headless:"new"}});
  const p=await b.newPage();
  const q=encodeURIComponent("{card_id} ワンピース カード");
  await p.goto("https://jp.mercari.com/search?keyword="+q+"&status=sold_out&sort=created_time&order=desc",{{waitUntil:"domcontentloaded",timeout:15000}});
  await new Promise(r=>setTimeout(r,4000));
  const prices=await p.evaluate(()=>{{
    return [...document.querySelectorAll('[data-testid="item-cell"]')].slice(0,5).map(el=>{{
      const p=el.querySelector('[class*="price"]');
      return p?parseInt(p.textContent.replace(/[^0-9]/g,"")):0;
    }}).filter(p=>p>0);
  }});
  console.log(JSON.stringify(prices));
  await b.close();
}})();'''],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0 and result.stdout.strip():
            prices = json.loads(result.stdout.strip())
            if prices:
                median = sorted(prices)[len(prices)//2]
                return {'results': [{'price': median, 'name': f'Mercari median of {len(prices)} sold', 'variant': 'normal', 'url': f'https://jp.mercari.com/search?keyword={card_id}'}], 'source': 'mercari'}
        return {'results': [], 'source': 'mercari'}
    except (subprocess.TimeoutExpired, FileNotFoundError, Exception) as e:
        return {'error': f'mercari bridge: {e}'}


def search_surugaya(card_id):
    """Search Suruga-ya. Uses embedded JS product data. Returns {results: [...]}."""
    url = f"https://www.suruga-ya.jp/search?category=&search_word={quote_plus(card_id)}&restrict%5B%5D=categorygroup_6"
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ja-JP'})
    try:
        html = urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')
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
        if p < 30:
            continue
        # Filter: name must start with the card ID
        if not name.startswith(card_id):
            continue
        is_parallel = 'パラレル' in name
        results.append({
            'price': p,
            'name': name[:80],
            'variant': 'parallel' if is_parallel else 'normal',
            'url': f"https://www.suruga-ya.jp/product/detail/{item_id}"
        })

    return {'results': results, 'source': 'surugaya', 'url': url}


# --- Price Computation ---

def compute_regional_price(source_prices, sources_config):
    """Weighted average: weight = 1/rank."""
    if not source_prices:
        return None
    weighted_sum = 0
    weight_total = 0
    for src, price in source_prices.items():
        if not price or price <= 0:
            continue
        rank = sources_config.get(src, {}).get('rank', 5)
        weight = 1.0 / rank
        weighted_sum += price * weight
        weight_total += weight
    return round(weighted_sum / weight_total) if weight_total else None


def compute_confidence(source_prices):
    n = len([p for p in source_prices.values() if p and p > 0])
    if n >= 3: return 'high'
    if n >= 2: return 'medium'
    if n >= 1: return 'low'
    return 'none'


# --- Main Scanner ---

def scan_card(card_id, sources_to_use=None):
    """Scan a single card. Returns pricing data for normal variant."""
    with open(SOURCES_FILE) as f:
        sources_config = json.load(f)['sources']

    scanners = {
        'surugaya': search_surugaya,
        'yuyutei': search_yuyutei,
        'cardrush': search_cardrush,
    }
    # Mercari requires Puppeteer — opt-in only
    if sources_to_use and 'mercari' in sources_to_use:
        scanners['mercari'] = search_mercari
    if sources_to_use:
        scanners = {k: v for k, v in scanners.items() if k in sources_to_use}

    source_prices = {}
    source_details = {}
    parallel_prices = {}
    today = date.today().isoformat()

    for src_name, search_fn in sorted(scanners.items(), key=lambda x: sources_config.get(x[0], {}).get('rank', 99)):
        result = search_fn(card_id)
        if 'error' in result:
            print(f"  ⚠️  {src_name}: {result['error']}")
            continue

        listings = result.get('results', [])
        normal = [r for r in listings if r['variant'] == 'normal']
        parallel = [r for r in listings if r['variant'] == 'parallel']

        if normal:
            floor = min(r['price'] for r in normal)
            source_prices[src_name] = floor
            source_details[src_name] = {'jpy': floor, 'updated': today, 'listings': len(normal)}
            print(f"  ✅ {src_name}: ¥{floor} ({len(normal)} normal listings)")
        elif parallel:
            # Only parallel found
            floor = min(r['price'] for r in parallel)
            parallel_prices[src_name] = floor
            print(f"  🔸 {src_name}: ¥{floor} (parallel only, {len(parallel)} listings)")
        else:
            print(f"  ❌ {src_name}: no results")

        time.sleep(DELAY_MS / 1000)

    regional_jpy = compute_regional_price(source_prices, sources_config)
    confidence = compute_confidence(source_prices)

    return {
        'sources': source_details,
        'regional_jpy': regional_jpy,
        'confidence': confidence,
        'parallel_prices': parallel_prices,
        'scanned': today
    }


def update_card_pricing(data, set_id, card_id, scan_result):
    """Update card pricing in DB."""
    for card in data['sets'].get(set_id, []):
        if card.get('id') == card_id or card.get('officialId') == card_id:
            pricing = card.setdefault('pricing', {})
            sources = pricing.setdefault('sources', {})
            for src, detail in scan_result['sources'].items():
                sources[src] = detail

            regional = pricing.setdefault('regional', {})
            if scan_result['regional_jpy']:
                regional['JP'] = {
                    'jpy': scan_result['regional_jpy'],
                    'confidence': scan_result['confidence'],
                    'sources': list(scan_result['sources'].keys()),
                    'updated': scan_result['scanned']
                }
                pricing.setdefault('computed', {})['jpy'] = scan_result['regional_jpy']

            pricing['updated'] = scan_result['scanned']
            return True
    return False


def main():
    parser = argparse.ArgumentParser(description='Regional Price Scanner')
    parser.add_argument('--set', help='Scan specific set (e.g. PRB-02)')
    parser.add_argument('--card', help='Scan specific card (e.g. PRB02-017)')
    parser.add_argument('--limit', type=int, default=0, help='Max cards to scan')
    parser.add_argument('--source', help='Only use specific source')
    parser.add_argument('--dry-run', action='store_true', help="Don't write to DB")
    parser.add_argument('--min-value', type=int, default=100, help='Only scan cards worth >= this (jpy)')
    args = parser.parse_args()

    with open(CACHE_FILE) as f:
        data = json.load(f)

    sources_to_use = [args.source] if args.source else None
    scanned = 0
    updated = 0
    log = []

    if args.card:
        print(f"🔍 Scanning {args.card}...")
        result = scan_card(args.card, sources_to_use)
        print(f"\n📊 Regional: ¥{result['regional_jpy']} (confidence: {result['confidence']})")
        if result['parallel_prices']:
            print(f"   Parallel: {result['parallel_prices']}")

        if not args.dry_run:
            for sid, cards in data['sets'].items():
                for c in cards:
                    if c.get('id') == args.card or c.get('officialId') == args.card:
                        if update_card_pricing(data, sid, args.card, result):
                            updated += 1
                            print(f"   💾 Updated in {sid}")
                        break
        scanned = 1
    else:
        target_sets = [args.set] if args.set else list(data['sets'].keys())
        cards_to_scan = []

        for sid in target_sets:
            if sid not in data['sets']:
                print(f"⚠️  Set {sid} not found"); continue
            seen_ids = set()
            for card in data['sets'][sid]:
                cid = card.get('id', '')
                if cid in seen_ids: continue
                seen_ids.add(cid)
                current_jpy = card.get('pricing', {}).get('computed', {}).get('jpy') or 0
                if current_jpy >= args.min_value or args.min_value == 0:
                    cards_to_scan.append((sid, cid, current_jpy))

        cards_to_scan.sort(key=lambda x: -x[2])
        if args.limit:
            cards_to_scan = cards_to_scan[:args.limit]

        print(f"📋 Scanning {len(cards_to_scan)} cards...")
        print(f"   Min value: ¥{args.min_value}, Sources: {sources_to_use or 'all JP'}\n")

        for sid, cid, current_jpy in cards_to_scan:
            print(f"[{scanned+1}/{len(cards_to_scan)}] {cid} (current: ¥{current_jpy})")
            result = scan_card(cid, sources_to_use)
            scanned += 1

            if result['regional_jpy']:
                diff = result['regional_jpy'] - current_jpy if current_jpy else 0
                arrow = '↑' if diff > 0 else '↓' if diff < 0 else '='
                print(f"  → Regional: ¥{result['regional_jpy']} ({arrow}{abs(diff)})\n")
                if not args.dry_run:
                    if update_card_pricing(data, sid, cid, result):
                        updated += 1
                log.append({'card': cid, 'set': sid, 'old': current_jpy,
                           'new': result['regional_jpy'], 'confidence': result['confidence']})
            else:
                print()

    if not args.dry_run and updated > 0:
        with open(CACHE_FILE, 'w') as f:
            json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
        print(f"\n💾 Saved {updated} card(s) to DB")

    if log:
        scan_entry = {'date': date.today().isoformat(), 'scanned': scanned, 'updated': updated, 'results': log}
        existing = json.load(open(SCAN_LOG)) if os.path.exists(SCAN_LOG) else []
        existing.append(scan_entry)
        with open(SCAN_LOG, 'w') as f:
            json.dump(existing[-50:], f, ensure_ascii=False, indent=2)

    print(f"\n✅ Done. Scanned: {scanned}, Updated: {updated}")


if __name__ == '__main__':
    main()
