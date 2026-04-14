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
            cards[key] = {
                'id': cid, 'finish': finish, 'jpy': jpy,
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
    """Scan Amazon for cards ¥500-¥10,000 regular finish."""
    candidates = {}
    for key, c in db_cards.items():
        if c['finish'] != 'regular' or not c['jpy']: continue
        if c['jpy'] < 500 or c['jpy'] > 10000: continue
        if c['id'] not in candidates or c['jpy'] > candidates[c['id']]['jpy']:
            candidates[c['id']] = c

    sorted_cards = sorted(candidates.values(), key=lambda x: -x['jpy'])[:20]
    deals = []

    for card in sorted_cards:
        time.sleep(1)
        listings = search_amazon(card['id'], 3)
        for l in listings:
            if l['is_parallel']: continue  # skip parallels
            score = (card['jpy'] - l['total']) / card['jpy'] if card['jpy'] > 0 else 0
            if 0.15 <= score <= 0.75:
                deals.append({**card, **l, 'market': card['jpy'], 'score': score})
                break

    deals.sort(key=lambda d: -d['score'])
    return deals[:5]

# --------------- Email ---------------

def build_email(deals, issues_fixed, issues):
    today = date.today().strftime('%Y-%m-%d')
    day = date.today().strftime('%a %b %d')

    html = f"""<html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9">
<h2 style="color:#D70000">🏴‍☠️ OP Deal Hunter — {day}</h2>
<p style="color:#666;font-size:13px">Scanned: Amazon JP · Budget: ¥10,000/week</p>
<hr style="border:1px solid #eee">
"""
    # Deals section
    if deals:
        for i, d in enumerate(deals):
            pct = d['score']*100
            html += f"""<div style="background:#fff;border-radius:10px;padding:14px;margin:10px 0;border-left:4px solid {'#D70000' if pct>=30 else '#f59e0b'}">
  <h3 style="margin:0 0 4px;font-size:15px">{'🔥' if pct>=30 else '💰'} {d['name']}</h3>
  <p style="margin:2px 0;color:#888;font-size:12px">{d['id']} · {d['set']} · {d['rarity']}</p>
  <p style="margin:6px 0"><span style="color:#D70000;font-weight:bold;font-size:17px">¥{d['total']:,}</span>
    <span style="color:#888;text-decoration:line-through;margin-left:6px">¥{d['market']:,}</span>
    <span style="color:#16a34a;font-weight:bold;margin-left:6px">-{pct:.0f}%</span></p>
  <p style="margin:2px 0;color:#888;font-size:11px">{d['source']}: ¥{d['price']:,} + ¥{d['shipping']:,} ship</p>
  <p style="margin:6px 0"><a href="{d.get('url','#')}" style="color:#D70000;font-size:13px;font-weight:bold">Buy →</a></p>
</div>"""
    else:
        html += '<p style="color:#888;text-align:center;padding:30px">No deals today meeting criteria.</p>'

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
