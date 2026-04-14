#!/usr/bin/env python3
"""Deal Hunter — scans JP card retailers for underpriced OP singles.
Sends daily email with top 5 deals. (#147)"""

import json, re, time, sys, os
from urllib.request import Request, urlopen
from urllib.parse import quote_plus
from datetime import datetime, date
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib

# Config
EMAIL_TO = "abrejon@amazon.com"
BUDGET_DAILY = 2000
BUDGET_WEEKLY = 10000
DEAL_THRESHOLD = 0.70  # listing+ship must be <= 70% of market
MIN_MARKET_VALUE = 200  # skip cards worth less than ¥200

SHIPPING = {
    "amazon": {"free_above": 2000, "flat": 410},
    "surugaya": {"flat": 440},
    "cardrush": {"flat": 200},
}

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
LEDGER_FILE = os.path.join(DATA_DIR, 'deal-hunter-ledger.json')

def load_market_db():
    """Load our price DB — only OP cards with prices >= MIN_MARKET_VALUE."""
    with open(os.path.join(DATA_DIR, 'onepiece-cache.json')) as f:
        data = json.load(f)
    cards = {}
    for setid, cardlist in data['sets'].items():
        if not isinstance(cardlist, list):
            continue
        for c in cardlist:
            cid = c.get('id', '')
            jpy = c.get('pricing', {}).get('computed', {}).get('jpy')
            if not jpy or jpy < MIN_MARKET_VALUE:
                continue
            finish = c.get('finish', 'regular')
            name = c.get('name', {})
            jp_name = name.get('jp', '') if isinstance(name, dict) else ''
            en_name = name.get('en', '') if isinstance(name, dict) else ''
            rarity = c.get('rarity', '')
            img = c.get('img', {})
            img_url = img.get('jp', '') if isinstance(img, dict) else ''
            key = f"{cid}|{finish}"
            if key not in cards or jpy > cards[key]['jpy']:
                cards[key] = {
                    'id': cid, 'finish': finish, 'jpy': jpy,
                    'name_jp': jp_name, 'name_en': en_name,
                    'rarity': rarity, 'set': setid, 'img': img_url
                }
    return cards

def search_amazon(query, max_results=5):
    """Search Amazon JP for a card by name/ID. Returns listings."""
    url = f"https://www.amazon.co.jp/s?k={quote_plus(query + ' ワンピースカード')}&i=toys"
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'ja-JP,ja;q=0.9'})
    try:
        html = urlopen(req, timeout=10).read().decode('utf-8', errors='ignore')
        # Extract prices
        prices = re.findall(r'<span class="a-price-whole">([0-9,]+)</span>', html)
        titles = re.findall(r'<span class="a-text-normal[^"]*">([^<]+)</span>', html)
        links = re.findall(r'<a class="a-link-normal[^"]*" href="(/dp/[^"]+)"', html)
        results = []
        for i in range(min(len(prices), len(titles), max_results)):
            price = int(prices[i].replace(',', ''))
            link = f"https://www.amazon.co.jp{links[i]}" if i < len(links) else ""
            ship = 0 if price >= SHIPPING['amazon']['free_above'] else SHIPPING['amazon']['flat']
            results.append({
                'source': 'Amazon JP', 'title': titles[i][:80],
                'price': price, 'shipping': ship, 'total': price + ship,
                'url': link
            })
        return results
    except Exception as e:
        return []

def search_surugaya(query, max_results=5):
    """Search Suruga-ya for a card."""
    url = f"https://www.suruga-ya.jp/search?category=&search_word={quote_plus(query)}&restrict%5B%5D=categorygroup_6"
    req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        html = urlopen(req, timeout=10).read().decode('utf-8', errors='ignore')
        # Suruga-ya prices in format: ¥XXX or XXX円
        items = re.findall(r'<p class="price[^"]*">\s*<span[^>]*>([0-9,]+)円', html)
        titles = re.findall(r'<p class="title"[^>]*>\s*<a[^>]*>([^<]+)', html)
        links = re.findall(r'<p class="title"[^>]*>\s*<a href="([^"]+)"', html)
        results = []
        for i in range(min(len(items), len(titles), max_results)):
            price = int(items[i].replace(',', ''))
            link = f"https://www.suruga-ya.jp{links[i]}" if i < len(links) else ""
            results.append({
                'source': 'Suruga-ya', 'title': titles[i].strip()[:80],
                'price': price, 'shipping': SHIPPING['surugaya']['flat'],
                'total': price + SHIPPING['surugaya']['flat'],
                'url': link
            })
        return results
    except Exception as e:
        return []

def find_deals(market_db):
    """Scan sources for deals on high-value cards."""
    deals = []
    # Focus on cards worth ¥500+ for better deal potential
    valuable = sorted(market_db.values(), key=lambda c: -c['jpy'])[:100]

    for card in valuable:
        query = card['id']
        time.sleep(0.5)  # rate limit

        # Search Amazon
        for listing in search_amazon(query, 3):
            if listing['total'] <= card['jpy'] * DEAL_THRESHOLD:
                score = (card['jpy'] - listing['total']) / card['jpy']
                deals.append({**card, **listing, 'market': card['jpy'], 'score': score})

        # Search Suruga-ya
        for listing in search_surugaya(card['name_jp'] or query, 3):
            if listing['total'] <= card['jpy'] * DEAL_THRESHOLD:
                score = (card['jpy'] - listing['total']) / card['jpy']
                deals.append({**card, **listing, 'market': card['jpy'], 'score': score})

        if len(deals) >= 20:
            break  # enough candidates

    # Sort by score, take top 5
    deals.sort(key=lambda d: -d['score'])
    return deals[:5]

def load_ledger():
    try:
        with open(LEDGER_FILE) as f:
            return json.load(f)
    except:
        return {'week_start': str(date.today()), 'spent_this_week': 0, 'history': []}

def build_email_html(deals, ledger):
    today = date.today().strftime('%Y-%m-%d')
    week_spent = ledger.get('spent_this_week', 0)
    week_remaining = BUDGET_WEEKLY - week_spent

    html = f"""<html><body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9">
<h2 style="color:#D70000">🏴‍☠️ One Piece Deal Hunter — {today}</h2>
<p style="color:#666;font-size:14px">Budget: ¥{week_spent:,} spent / ¥{BUDGET_WEEKLY:,} weekly cap (¥{week_remaining:,} remaining)</p>
<hr style="border:1px solid #eee">
"""
    if not deals:
        html += '<p style="color:#888;text-align:center;padding:40px">No deals found today. Market prices are holding steady.</p>'
    else:
        for i, d in enumerate(deals):
            savings = d['market'] - d['total']
            pct = d['score'] * 100
            badge = '🔥' if pct >= 50 else '💰'
            html += f"""
<div style="background:#fff;border-radius:12px;padding:16px;margin:12px 0;border-left:4px solid {'#D70000' if pct>=50 else '#f59e0b'}">
  <div style="display:flex;gap:12px;align-items:flex-start">
    <div style="flex:1">
      <h3 style="margin:0 0 4px;font-size:16px">{badge} #{i+1} — {d.get('name_en') or d.get('name_jp') or d['id']}</h3>
      <p style="margin:2px 0;color:#888;font-size:13px">{d['id']} · {d.get('set','')} · {d.get('rarity','')}</p>
      <p style="margin:8px 0 2px;font-size:14px">
        <span style="color:#D70000;font-weight:bold;font-size:18px">¥{d['total']:,}</span>
        <span style="color:#888;text-decoration:line-through;margin-left:8px">¥{d['market']:,}</span>
        <span style="color:#16a34a;font-weight:bold;margin-left:8px">-{pct:.0f}%</span>
      </p>
      <p style="margin:2px 0;color:#888;font-size:12px">{d['source']}: ¥{d['price']:,} + ¥{d['shipping']:,} shipping</p>
      <p style="margin:8px 0 0"><a href="{d.get('url','#')}" style="color:#D70000;font-weight:bold;font-size:14px">Buy now →</a></p>
    </div>
  </div>
</div>"""

    html += """
<hr style="border:1px solid #eee;margin-top:20px">
<p style="color:#999;font-size:11px;text-align:center">
  PokePiece Deal Hunter · Prices from Amazon JP & Suruga-ya · Market prices from our DB<br>
  Deals are not investment advice. Verify listings before purchasing.
</p>
</body></html>"""
    return html

def send_email(html, deals_count):
    """Send via local mail or print to stdout for testing."""
    today = date.today().strftime('%Y-%m-%d')
    subject = f"🏴‍☠️ {deals_count} OP deal{'s' if deals_count != 1 else ''} found — {today}" if deals_count else f"No OP deals today — {today}"

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = 'deal-hunter@pokepiece.local'
    msg['To'] = EMAIL_TO
    msg.attach(MIMEText(html, 'html'))

    # For testing: save to file
    outfile = os.path.join(DATA_DIR, 'deal-hunter-latest.html')
    with open(outfile, 'w') as f:
        f.write(html)
    print(f"📧 Email saved to {outfile}")
    print(f"   Subject: {subject}")
    print(f"   To: {EMAIL_TO}")
    return outfile

def main():
    print("🔍 Loading market database...")
    db = load_market_db()
    print(f"   {len(db)} priced cards (≥¥{MIN_MARKET_VALUE})")

    print("🌐 Scanning retailers...")
    deals = find_deals(db)
    print(f"   {len(deals)} deals found")

    for d in deals:
        pct = d['score'] * 100
        print(f"   {'🔥' if pct>=50 else '💰'} {d['id']} {d.get('name_en','')} — ¥{d['total']:,} vs ¥{d['market']:,} (-{pct:.0f}%) @ {d['source']}")

    ledger = load_ledger()
    html = build_email_html(deals, ledger)
    send_email(html, len(deals))

if __name__ == '__main__':
    main()
