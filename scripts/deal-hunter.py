#!/usr/bin/env python3
"""Deal Hunter — daily scan of JP retailers, fix pricing issues, email top deals.
Run: python3 scripts/deal-hunter.py
Cron: 0 1 * * * /mnt/c/q/Pokemon/scripts/deal-hunter.sh  (10am JST = 1am UTC)
"""

import json, re, time, os, subprocess, sys
from urllib.request import Request, urlopen
from urllib.parse import quote_plus
from datetime import date, datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, '..', 'data')
CACHE_FILE = os.path.join(DATA_DIR, 'onepiece-cache.json')
LEDGER_FILE = os.path.join(DATA_DIR, 'deal-hunter-ledger.json')
EMAIL_TO = "abrejon@amazon.com"
EMAIL_FROM = "abrejon@amazon.com"

SHIPPING = {
    "amazon": {"free_above": 2000, "flat": 410},
    "surugaya": {"flat": 440},
    "cardrush": {"flat": 200},
}

BUDGET_DAILY = 2000
BUDGET_WEEKLY = 10000
DEAL_THRESHOLD = 0.70
MIN_MARKET_VALUE = 200

WATCHLIST_FILE = os.path.join(DATA_DIR, 'deal-hunter-watchlist.json')

def load_watchlist():
    try:
        with open(WATCHLIST_FILE) as f:
            return json.load(f).get('watchlist', [])
    except:
        return []

def load_ledger():
    try:
        with open(LEDGER_FILE) as f:
            ledger = json.load(f)
        ws = ledger.get('week_start','')
        if ws and (date.today() - date.fromisoformat(ws)).days >= 7:
            ledger = {'week_start': str(date.today()), 'spent': 0, 'purchases': []}
        return ledger
    except:
        return {'week_start': str(date.today()), 'spent': 0, 'purchases': []}

def save_ledger(ledger):
    with open(LEDGER_FILE, 'w') as f:
        json.dump(ledger, f, indent=2)

# --------------- Market DB ---------------

def load_db():
    with open(CACHE_FILE) as f:
        data = json.load(f)
    cards = {}
    for setid, cardlist in data['sets'].items():
        if not isinstance(cardlist, list): continue
        for c in cardlist:
            cid = c.get('id','')
            jpy = c.get('pricing',{}).get('computed',{}).get('jpy')
            finish = c.get('finish','regular')
            name = c.get('name',{})
            en = name.get('en','') if isinstance(name,dict) else ''
            jp = name.get('jp','') if isinstance(name,dict) else ''
            rarity = c.get('rarity','')
            key = f"{cid}|{finish}"
            usd = c.get('pricing',{}).get('computed',{}).get('usd')
            cards[key] = {
                'id': cid, 'finish': finish, 'jpy': jpy, 'usd': usd,
                'name': en or jp, 'rarity': rarity, 'set': setid
            }
    return data, cards

# --------------- Amazon Scraper ---------------

def search_amazon(card_id, max_results=5):
    query = f"{card_id} ワンピースカード"
    url = f"https://www.amazon.co.jp/s?k={quote_plus(query)}&i=toys"
    req = Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ja-JP,ja;q=0.9'
    })
    try:
        html = urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')
        prices = [int(p.replace(',','')) for p in re.findall(r'<span class="a-price-whole">([0-9,]+)</span>', html)]
        labels = re.findall(r'aria-label="([^"]*)"', html)
        links = re.findall(r'href="(/[^"]*?/dp/[A-Z0-9]{10}[^"]*)"', html)

        results = []
        for label in labels:
            if card_id not in label: continue
            # Detect variant from title
            is_parallel = any(k in label for k in ['パラレル','SEC','コミック','スーパーレア','金枠','ホイル'])
            is_regular = not is_parallel
            # Find a reasonable price
            for p in prices:
                if p < 30: continue
            # Skip sold out (品切れ/在庫なし in nearby HTML)
                ship = 0 if p >= SHIPPING['amazon']['free_above'] else SHIPPING['amazon']['flat']
                results.append({
                    'source': 'Amazon JP', 'title': label[:80],
                    'price': p, 'shipping': ship, 'total': p + ship,
                    'url': f"https://www.amazon.co.jp{links[0]}" if links else "",
                    'is_parallel': is_parallel
                })
                break
            if len(results) >= max_results: break
        return results
    except:
        return []


# --------------- Card Rush Scraper ---------------

def search_cardrush(card_id, max_results=5):
    """Search Card Rush OP for a card. Returns listings with variant info."""
    url = f"https://www.cardrush-op.jp/product-list?keyword={quote_plus(card_id)}"
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
    try:
        html = urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')
        raw = re.findall(
            r'href="(https?://www\.cardrush-op\.jp/product/\d+)"[^>]*>\s*'
            r'(?:<[^>]*>)*\s*(.*?)(\d{1,3}(?:,\d{3})*)円',
            html, re.DOTALL
        )
        results = []
        for link, content, price in raw[:max_results]:
            texts = [t.strip() for t in re.findall(r'>([^<]+)<', content) if t.strip()]
            title = ' '.join(texts)[:80] if texts else card_id
            p = int(price.replace(',',''))
            is_parallel = any(k in title for k in ['パラレル','SP','コミック','金背景','銀背景','手配書'])
            if p < 30 or 'デッキ販売' in title: continue  # skip decks
            results.append({
                'source': 'Card Rush', 'title': title,
                'price': p, 'shipping': SHIPPING['cardrush']['flat'],
                'total': p + SHIPPING['cardrush']['flat'],
                'url': link, 'is_parallel': is_parallel
            })
        return results
    except:
        return []


# --------------- Suruga-ya Scraper ---------------

def search_surugaya(card_id, max_results=5):
    """Search Suruga-ya for a card. Extracts from embedded JS product data."""
    url = f"https://www.suruga-ya.jp/search?category=&search_word={quote_plus(card_id)}&restrict%5B%5D=categorygroup_6"
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ja-JP'})
    try:
        html = urlopen(req, timeout=15).read().decode('utf-8', errors='ignore')
        items = re.findall(
            r"item_id:\s*common\.htmlDecode\('([^']+)'\).*?"
            r"item_name:\s*common\.htmlDecode\('([^']+)'\).*?"
            r"price:\s*(\d+)",
            html, re.DOTALL
        )
        results = []
        for item_id, name, price in items[:max_results]:
            p = int(price)
            if p < 30: continue
            # Skip sold out (品切れ/在庫なし in nearby HTML)
            # Only include if card_id is in the name
            if card_id.replace('-','') not in name.replace('-','').replace(' ',''): continue
            is_parallel = any(k in name for k in ['パラレル','SP','コミック','金背景','銀背景','手配書'])
            results.append({
                'source': 'Suruga-ya', 'title': name[:80],
                'price': p, 'shipping': SHIPPING['surugaya']['flat'],
                'total': p + SHIPPING['surugaya']['flat'],
                'url': f"https://www.suruga-ya.jp/product/detail/{item_id}",
                'is_parallel': is_parallel
            })
        return results
    except:
        return []

# --------------- Pricing Issue Detection ---------------

def detect_pricing_issues(db_cards):
    """Find cards where regular finish has suspiciously high price (likely parallel price leak)."""
    issues = []
    by_id = {}
    for key, c in db_cards.items():
        cid = c['id']
        if cid not in by_id: by_id[cid] = []
        by_id[cid].append(c)

    for cid, variants in by_id.items():
        regular = [v for v in variants if v['finish'] == 'regular' and v['jpy']]
        parallels = [v for v in variants if 'parallel' in v['finish'] and v['jpy']]
        if not regular or not parallels: continue

        reg_price = regular[0]['jpy']
        par_prices = [p['jpy'] for p in parallels]

        # Flag: regular price == highest parallel price (likely copied, not real)
        if reg_price > 5000 and reg_price == max(par_prices):
            issues.append({
                'id': cid, 'name': regular[0]['name'], 'rarity': regular[0]['rarity'],
                'set': regular[0]['set'],
                'regular_price': reg_price, 'parallel_prices': par_prices,
                'issue': f"Regular ¥{reg_price:,} == parallel max — likely inflated"
            })

    return issues

def fix_pricing_issues(data, issues):
    """For flagged cards, estimate regular price from rarity."""
    rarity_estimates = {
        'L': 50, 'C': 30, 'UC': 30, 'R': 80, 'SR': 300,
        'SEC': 2000, 'SP': 500, 'P': 200
    }
    fixed = 0
    for issue in issues:
        est = rarity_estimates.get(issue['rarity'], 100)
        for setid, cards in data['sets'].items():
            if not isinstance(cards, list): continue
            for c in cards:
                if c.get('id') == issue['id'] and c.get('finish') == 'regular':
                    old = c.get('pricing',{}).get('computed',{}).get('jpy')
                    if old and old > est * 10:  # only fix if wildly off
                        c['pricing']['computed']['jpy'] = est
                        c['pricing']['method'] = 'deal-hunter-corrected'
                        c['pricing']['updated'] = date.today().isoformat()
                        fixed += 1
    return fixed

# --------------- Deal Finding ---------------

def find_deals(db_cards):
    """Scan sources for watchlist cards first, then top valuable."""
    # Build candidate pool
    candidates = {}
    for key, c in db_cards.items():
        if c['finish'] != 'regular' or not c['jpy']: continue
        if c['jpy'] < 200: continue
        if c['id'] not in candidates or c['jpy'] > candidates[c['id']]['jpy']:
            candidates[c['id']] = c

    # Watchlist cards first (priority)
    watchlist = load_watchlist()
    watch_ids = {w['id'] for w in watchlist}
    priority = [candidates[cid] for cid in watch_ids if cid in candidates]

    # Then top valuable (excluding watchlist, already scanned)
    rest = [c for c in candidates.values() if c['id'] not in watch_ids and c['jpy'] >= 500]
    rest.sort(key=lambda x: -x['jpy'])

    sorted_cards = priority + rest[:max(0, 20 - len(priority))]
    deals = []

    for card in sorted_cards:
        time.sleep(1)
        # Search both Amazon and Card Rush
        for search_fn in [search_cardrush, search_surugaya, search_amazon]:
            listings = search_fn(card['id'], 3)
            for l in listings:
                if l['is_parallel']: continue
                score = (card['jpy'] - l['total']) / card['jpy'] if card['jpy'] > 0 else 0
                # Owned cards need a higher deal ratio (30% vs 15%)
            owned = {w['id'] for w in load_watchlist() if w.get('owned')}
            min_score = 0.30 if card['id'] in owned else 0.15
            if min_score <= score <= 0.75:
                    deals.append({**card, **l, 'market': card['jpy'], 'score': score})
                    break
            time.sleep(0.5)

    deals.sort(key=lambda d: -d['score'])
    return deals[:5]


# --------------- Bundle Optimization ---------------

def find_bundles(deals):
    """Group deals by source. If 2+ cards from same source, shipping is shared."""
    by_source = {}
    for d in deals:
        src = d['source']
        if src not in by_source: by_source[src] = []
        by_source[src].append(d)
    
    bundles = []
    for src, items in by_source.items():
        if len(items) < 2: continue
        ship = items[0]['shipping']  # flat rate per source
        individual_total = sum(i['price'] + ship for i in items)
        bundle_total = sum(i['price'] for i in items) + ship  # one shipping
        savings = individual_total - bundle_total
        if savings > 0:
            bundles.append({
                'source': src, 'cards': items, 'shipping': ship,
                'bundle_total': bundle_total, 'individual_total': individual_total,
                'savings': savings
            })
    return bundles


def _arb_html(d):
    """Generate arbitrage info HTML for a deal."""
    usd_sell = d.get('usd')
    if not usd_sell or usd_sell < 1: return ''
    jpy_cost = d['total']
    usd_cost = jpy_cost / 150  # JPY to USD
    shipping_us = 7  # ~$7 small packet JP→US
    platform_fee = usd_sell * 0.15  # TCGplayer/eBay 15%
    net_profit = usd_sell - usd_cost - shipping_us - platform_fee
    margin = net_profit / usd_sell if usd_sell > 0 else 0
    if margin < 0.05: return ''  # not worth showing
    color = '#16a34a' if margin >= 0.20 else '#888'
    return f'<p style="margin:2px 0;font-size:11px;color:{color}">🌐 US sell: ${usd_sell:.0f} → net ${net_profit:.0f} profit ({margin:.0%} margin after fees+ship)</p>'

# --------------- Email ---------------

def build_email(deals, issues_fixed, issues):
    today = date.today().strftime('%Y-%m-%d')
    day = date.today().strftime('%a %b %d')

    ledger = load_ledger()
    spent = ledger.get('spent', 0)
    remaining = BUDGET_WEEKLY - spent

    html = f"""<html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9">
<h2 style="color:#D70000">🏴‍☠️ OP Deal Hunter — {day}</h2>
<p style="color:#666;font-size:13px">Sources: Card Rush · Suruga-ya · Amazon JP</p>
<p style="color:#666;font-size:13px">💰 Budget: ¥{spent:,} spent / ¥{BUDGET_WEEKLY:,} weekly (¥{remaining:,} left) · Daily cap: ¥{BUDGET_DAILY:,}</p>
<hr style="border:1px solid #eee">
"""
    # Deals section
    if deals:
        for i, d in enumerate(deals):
            pct = d['score']*100
            html += f"""<div style="background:#fff;border-radius:10px;padding:14px;margin:10px 0;border-left:4px solid {'#D70000' if pct>=30 else '#f59e0b'}">
  <h3 style="margin:0 0 4px;font-size:15px">{'🔥' if pct>=30 else '💰'} {d['name']}{'  ⭐' if d['id'] in [w['id'] for w in load_watchlist()] else ''}</h3>
  <p style="margin:2px 0;color:#888;font-size:12px">{d['id']} · {d['set']} · {d['rarity']}</p>
  <p style="margin:6px 0"><span style="color:#D70000;font-weight:bold;font-size:17px">¥{d['total']:,}</span>
    <span style="color:#888;text-decoration:line-through;margin-left:6px">¥{d['market']:,}</span>
    <span style="color:#16a34a;font-weight:bold;margin-left:6px">-{pct:.0f}%</span></p>
  <p style="margin:2px 0;color:#888;font-size:11px">{d['source']}: ¥{d['price']:,} + ¥{d['shipping']:,} ship</p>
  <p style="margin:6px 0"><a href="{d.get('url','#')}" style="color:#D70000;font-size:13px;font-weight:bold">Buy →</a></p>
  {_arb_html(d)}
</div>"""
    else:
        html += '<p style="color:#888;text-align:center;padding:30px">No deals today meeting criteria.</p>'

    # Bundle section
    bundles = find_bundles(deals)
    if bundles:
        html += '<hr style="border:1px solid #eee">'
        for b in bundles:
            cards_str = ', '.join(d['id'] for d in b['cards'])
            html += f'''<div style="background:#e8f5e9;border-radius:10px;padding:12px;margin:10px 0">
  <h3 style="margin:0 0 4px;font-size:14px">📦 Bundle: {b["source"]}</h3>
  <p style="margin:2px 0;font-size:12px;color:#444">{cards_str}</p>
  <p style="margin:4px 0;font-size:13px">Buy together: <strong>¥{b["bundle_total"]:,}</strong> (save ¥{b["savings"]:,} on shipping)</p>
</div>'''

    # Pricing fixes section
    if issues:
        html += f"""<hr style="border:1px solid #eee">
<h3 style="font-size:14px;color:#444">🔧 Pricing Issues Detected & Fixed ({issues_fixed})</h3>
<table style="width:100%;font-size:12px;border-collapse:collapse">
<tr style="background:#f5f5f5"><th style="padding:4px 8px;text-align:left">Card</th><th>Was</th><th>Issue</th></tr>"""
        for iss in issues[:10]:
            html += f"""<tr style="border-bottom:1px solid #eee">
  <td style="padding:4px 8px">{iss['id']} {iss['name'][:20]}</td>
  <td style="padding:4px 8px;color:#D70000">¥{iss['regular_price']:,}</td>
  <td style="padding:4px 8px;color:#888;font-size:11px">{iss['issue'][:50]}</td>
</tr>"""
        html += '</table>'

    html += """<hr style="border:1px solid #eee;margin-top:16px">
<p style="color:#aaa;font-size:10px;text-align:center">PokePiece Deal Hunter · Auto-generated · Verify before buying</p>
</body></html>"""
    return html

def send_ses(subject, html_body):
    """Send via AWS SES like morning-digest."""
    # Escape for JSON
    escaped = html_body.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')
    content = f'{{"Simple":{{"Subject":{{"Data":"{subject}"}},"Body":{{"Html":{{"Data":"{escaped}"}}}}}}}}'

    cmd = [
        'aws', 'sesv2', 'send-email',
        '--profile', 'jp-gc', '--region', 'us-east-1',
        '--from-email-address', EMAIL_FROM,
        '--destination', f'ToAddresses={EMAIL_TO}',
        '--content', content
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode == 0:
        msg_id = json.loads(result.stdout).get('MessageId','?')
        print(f"📧 Email sent! MessageId: {msg_id}")
    else:
        print(f"❌ SES error: {result.stderr[:200]}")
    return result.returncode == 0

# --------------- Main ---------------

def main():
    print(f"🏴‍☠️ Deal Hunter — {date.today()}")

    print("📦 Loading DB...")
    data, db_cards = load_db()
    print(f"   {len(db_cards)} card variants loaded")

    print("🔍 Detecting pricing issues...")
    issues = detect_pricing_issues(db_cards)
    print(f"   {len(issues)} issues found")
    for iss in issues[:5]:
        print(f"   ⚠️ {iss['id']} {iss['name'][:25]} — {iss['issue']}")

    print("🔧 Fixing pricing...")
    fixed = fix_pricing_issues(data, issues)
    if fixed:
        with open(CACHE_FILE, 'w') as f:
            json.dump(data, f, separators=(',',':'))
        print(f"   ✅ {fixed} prices corrected in DB")
    else:
        print(f"   No fixes needed")

    # Reload after fixes
    data, db_cards = load_db()

    print("🌐 Scanning Amazon JP...")
    deals = find_deals(db_cards)
    print(f"   {len(deals)} deals found")

    # Build and send email
    day = date.today().strftime('%a %b %d')
    subject = f"🏴‍☠️ {len(deals)} OP deal{'s' if len(deals)!=1 else ''} — {day}" if deals else f"🏴‍☠️ No OP deals — {day}"

    html = build_email(deals, fixed, issues)
    
    # Save ledger
    ledger = load_ledger()
    save_ledger(ledger)

    # Save locally
    outfile = os.path.join(DATA_DIR, f"deal-hunter-{date.today()}.html")
    with open(outfile, 'w') as f:
        f.write(html)
    print(f"💾 Saved to {outfile}")

    # Send via SES
    if '--no-email' not in sys.argv:
        send_ses(subject, html)
    else:
        print("   (--no-email flag, skipping send)")

if __name__ == '__main__':
    main()
