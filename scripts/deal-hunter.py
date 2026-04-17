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
    "surugaya": {"flat": 440, "free_above": 1500},
    "cardrush": {"flat": 200},
}

BUDGET_DAILY = 2000
BUDGET_WEEKLY = 10000
DEAL_THRESHOLD = 0.70
MIN_MARKET_VALUE = 200

WATCHLIST_FILE = os.path.join(DATA_DIR, 'deal-hunter-watchlist.json')
OVERRIDES_FILE = os.path.join(DATA_DIR, 'deal-hunter-overrides.json')
BLOCKLIST_FILE = os.path.join(DATA_DIR, 'deal-hunter-blocklist.json')
HISTORY_FILE = os.path.join(DATA_DIR, 'deal-hunter-correction-history.jsonl')


def _load_json(path, default):
    try:
        with open(path) as f: return json.load(f)
    except: return default

def load_overrides():
    """Manual price locks: {card_id: {price, reason}}. Skip correction + use this price."""
    return {k: v for k, v in _load_json(OVERRIDES_FILE, {}).items() if not k.startswith('_')}

def load_blocklist():
    """Excluded cards: {card_id: {until: 'YYYY-MM-DD', reason}}. Skipped from scan."""
    raw = {k: v for k, v in _load_json(BLOCKLIST_FILE, {}).items() if not k.startswith('_')}
    today = date.today().isoformat()
    return {cid: v for cid, v in raw.items() if v.get('until', '9999-12-31') >= today}

def recent_correction_dirs(days=7):
    """Return {card_id: last_direction} from history within N days. direction: +1 up, -1 down."""
    if not os.path.exists(HISTORY_FILE): return {}
    cutoff = (date.today() - __import__('datetime').timedelta(days=days)).isoformat()
    dirs = {}
    try:
        with open(HISTORY_FILE) as f:
            for line in f:
                try: e = json.loads(line)
                except: continue
                if e.get('date', '') < cutoff: continue
                dirs[e['id']] = 1 if e['new'] > e['old'] else -1
    except: pass
    return dirs

def append_history(corrections):
    with open(HISTORY_FILE, 'a') as f:
        for c in corrections:
            f.write(json.dumps({'date': date.today().isoformat(), **c}) + '\n')


# --------------- Shared variant matching ---------------

# Matches: OP02-001, ST21-014_p1, EB02-061_p2, PRB01-001_p3, P-078
CARD_ID_RE = re.compile(r'\b((?:OP|ST|EB|PRB|P)[-\s]?\d{2,3}(?:-\d{3})?)(?:[_\s]?(p\d))?\b', re.IGNORECASE)
SOLD_OUT_MARKERS = ['売り切れ', '在庫なし', '品切れ', 'SOLD OUT', '販売終了', '完売']

def match_variant(title, target_id):
    r"""Extract Bandai card ID from listing title and classify as regular/parallel/no-match.
    Returns (is_match: bool, is_parallel: bool).
    
    JP retailers don't use _p1/_p2 suffixes (those are internal Bandai IDs).
    So we match by exact card ID, then classify variant via keyword heuristics on title.
    """
    norm_title = title.upper().replace(' ', '').replace('　', '')
    norm_target = target_id.upper().replace(' ', '')
    if norm_target not in norm_title:
        return False, False
    # Variant keywords: Japanese + English + symbols used on JP card shop listings
    parallel_markers = [
        'パラレル', 'PARALLEL',  # parallel (most common)
        'コミック', 'MANGA', '漫画',  # manga variant
        'アルトアート', 'ALTART', 'ALT ART', 'EXTENDED', 'フルアート',  # alt art / full bleed
        'SP', 'スペシャル',  # special
        'シークレット', 'SECRET', 'SEC',  # secret rare
        '金枠', '銀枠', '金背景', '銀背景',  # gold/silver frame/bg
        '手配書', 'WANTED',  # wanted poster variant
        'ホイル', 'FOIL',  # foil
        '再録', 'REPRINT',  # reprints (premium booster editions)
        'プレミアム', 'PREMIUM',
    ]
    is_parallel = any(m in title.upper() for m in parallel_markers) or any(m in title for m in parallel_markers)
    return True, is_parallel

def is_sold_out(text):
    return any(m in text for m in SOLD_OUT_MARKERS)

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
            is_match, is_parallel = match_variant(label, card_id)
            if not is_match: continue
            if is_sold_out(label): continue
            # Find a reasonable price
            for p in prices:
                if p < 30: continue
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
        for link, content, price in raw[:max_results*2]:
            texts = [t.strip() for t in re.findall(r'>([^<]+)<', content) if t.strip()]
            title = ' '.join(texts)[:80] if texts else card_id
            p = int(price.replace(',',''))
            if p < 30 or 'デッキ販売' in title: continue  # skip decks
            if is_sold_out(title) or is_sold_out(content): continue
            is_match, is_parallel = match_variant(title, card_id)
            if not is_match: continue
            results.append({
                'source': 'Card Rush', 'title': title,
                'price': p, 'shipping': SHIPPING['cardrush']['flat'],
                'total': p + SHIPPING['cardrush']['flat'],
                'url': link, 'is_parallel': is_parallel
            })
            if len(results) >= max_results: break
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
        for item_id, name, price in items[:max_results*2]:
            p = int(price)
            if p < 30: continue
            if is_sold_out(name): continue
            is_match, is_parallel = match_variant(name, card_id)
            if not is_match: continue
            results.append({
                'source': 'Suruga-ya', 'title': name[:80],
                'price': p, 'shipping': 0 if p >= SHIPPING['surugaya']['free_above'] else SHIPPING['surugaya']['flat'],
                'total': p + (0 if p >= SHIPPING['surugaya']['free_above'] else SHIPPING['surugaya']['flat']),
                'url': f"https://www.suruga-ya.jp/product/detail/{item_id}",
                'is_parallel': is_parallel
            })
            if len(results) >= max_results: break
        return results
    except:
        return []

# --------------- Consensus Pricing & Deal Finding ---------------

def scrape_all_sources(card_id):
    """Scrape all sources for a card, return regular-finish listings."""
    all_listings = []
    for search_fn in [search_cardrush, search_surugaya, search_amazon]:
        listings = search_fn(card_id, 3)
        for l in listings:
            if not l['is_parallel']:
                all_listings.append(l)
        time.sleep(0.8)
    return all_listings

def consensus_price(listings):
    """Median total price from 3+ sources = consensus. Returns None if < 3 sources."""
    if len(listings) < 3:
        return None
    totals = sorted(l['total'] for l in listings)
    mid = len(totals) // 2
    return totals[mid] if len(totals) % 2 else (totals[mid-1] + totals[mid]) // 2

def correct_db_price(data, card_id, new_price, old_price):
    """Update cache when consensus disagrees with DB. Returns True if corrected."""
    for setid, cards in data['sets'].items():
        if not isinstance(cards, list): continue
        for c in cards:
            if c.get('id') == card_id and c.get('finish') == 'regular':
                c.setdefault('pricing', {}).setdefault('computed', {})['jpy'] = new_price
                c['pricing']['method'] = 'consensus-corrected'
                c['pricing']['corrected_from'] = old_price
                c['pricing']['updated'] = date.today().isoformat()
                return True
    return False

def find_deals(db_cards, data):
    """Consensus-based deal finding. Scrape multiple sources, compare against each other."""
    # Build candidate pool
    candidates = {}
    for key, c in db_cards.items():
        if c['finish'] != 'regular' or not c['jpy']: continue
        if c['jpy'] < MIN_MARKET_VALUE: continue
        if c['id'] not in candidates or c['jpy'] > candidates[c['id']]['jpy']:
            candidates[c['id']] = c

    watchlist = load_watchlist()
    watch_ids = {w['id'] for w in watchlist}
    owned = {w['id'] for w in watchlist if w.get('owned')}
    overrides = load_overrides()
    blocklist = load_blocklist()
    recent_dirs = recent_correction_dirs(days=7)

    # Exclude blocklisted cards from scan entirely
    for bid in blocklist: candidates.pop(bid, None)

    # Watchlist first, then top valuable
    priority = [candidates[cid] for cid in watch_ids if cid in candidates]
    rest = [c for c in candidates.values() if c['id'] not in watch_ids and c['jpy'] >= 500]
    rest.sort(key=lambda x: -x['jpy'])
    sorted_cards = priority + rest[:max(0, 20 - len(priority))]

    deals = []
    corrections = []

    for card in sorted_cards:
        listings = scrape_all_sources(card['id'])
        if not listings:
            continue

        db_price = card['jpy']
        # Drop obvious garbage: listings <20% of DB price are likely damaged/sold-out/wrong-card
        listings = [l for l in listings if l['total'] >= db_price * 0.20]
        if not listings:
            continue

        market = consensus_price(listings)

        # Override: use manual locked price as truth, skip correction
        if card['id'] in overrides:
            true_price = overrides[card['id']].get('price', db_price)
        else:
            # Correct DB only if consensus exists AND divergence >30% AND not ping-ponging
            if market and abs(market - db_price) / max(db_price, 1) > 0.30:
                new_dir = 1 if market > db_price else -1
                last_dir = recent_dirs.get(card['id'])
                # Flip-guard: if we corrected this card within 7d in opposite direction, require stronger evidence
                ping_pong = last_dir is not None and last_dir != new_dir
                strong_evidence = ping_pong and (len(listings) >= 4 and abs(market - db_price) / max(db_price, 1) > 0.50)
                if not ping_pong or strong_evidence:
                    corrections.append({
                        'id': card['id'], 'name': card['name'], 'rarity': card['rarity'],
                        'set': card['set'], 'old': db_price, 'new': market,
                        'sources': len(listings)
                    })
                    correct_db_price(data, card['id'], market, db_price)
                else:
                    print(f"   ⏸  Skipped flip: {card['id']} {card['name'][:25]} ¥{db_price:,}→¥{market:,} (ping-pong, needs stronger evidence)")
            true_price = market or db_price

        # Find cheapest listing that's a real deal vs consensus
        for l in sorted(listings, key=lambda x: x['total']):
            if true_price <= MIN_MARKET_VALUE:
                break
            discount = (true_price - l['total']) / true_price
            min_discount = 0.30 if card['id'] in owned else 0.15
            if min_discount <= discount <= 0.75:
                deals.append({
                    **card, **l,
                    'market': true_price, 'db_price': db_price,
                    'score': discount
                })
                break

        time.sleep(0.5)

    # Save corrected DB if any fixes
    if corrections:
        with open(CACHE_FILE, 'w') as f:
            json.dump(data, f, separators=(',', ':'))
        append_history(corrections)
        print(f"   📝 {len(corrections)} DB prices corrected via consensus:")
        for c in corrections:
            print(f"      {c['id']} {c['name'][:25]}: ¥{c['old']:,} → ¥{c['new']:,}")

    deals.sort(key=lambda d: -d['score'])
    return deals[:5], corrections


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

def build_email(deals, corrections):
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
  <p style="margin:4px 0;font-size:13px">Buy together: <strong>¥{b["bundle_total"]:,}</strong> (save ¥{b["savings"]:,} on shipping){' · 🚚 FREE shipping!' if b["source"]=='Suruga-ya' and sum(d["price"] for d in b["cards"])>=1500 else ''}</p>
</div>'''

    # DB corrections section
    if corrections:
        html += f"""<hr style="border:1px solid #eee">
<h3 style="font-size:14px;color:#444">📝 DB Prices Corrected ({len(corrections)})</h3>
<p style="font-size:11px;color:#888;margin:0 0 8px">💡 To lock a price: edit <code>data/deal-hunter-overrides.json</code>. To skip a card: edit <code>data/deal-hunter-blocklist.json</code>.</p>
<table style="width:100%;font-size:12px;border-collapse:collapse">
<tr style="background:#f5f5f5"><th style="padding:4px 8px;text-align:left">Card</th><th>Was</th><th>Now</th><th>Sources</th></tr>"""
        for c in corrections[:10]:
            html += f"""<tr style="border-bottom:1px solid #eee">
  <td style="padding:4px 8px">{c['id']} {c['name'][:20]}</td>
  <td style="padding:4px 8px;color:#D70000">¥{c['old']:,}</td>
  <td style="padding:4px 8px;color:#16a34a">¥{c['new']:,}</td>
  <td style="padding:4px 8px;color:#888">{c.get('sources','?')}</td>
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

    print("🌐 Scanning sources & building consensus prices...")
    deals, corrections = find_deals(db_cards, data)
    print(f"   {len(deals)} deals found, {len(corrections)} DB prices corrected")

    # Build and send email
    day = date.today().strftime('%a %b %d')
    subject = f"🏴‍☠️ {len(deals)} OP deal{'s' if len(deals)!=1 else ''} — {day}" if deals else f"🏴‍☠️ No OP deals — {day}"

    html = build_email(deals, corrections)
    
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
