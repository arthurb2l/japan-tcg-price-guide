# Pricing Data Sources

## Current Coverage (2026-03-27)

| Game | Cards | JP-Verified | Bulk Est. | No Price | Source |
|------|-------|-------------|-----------|----------|--------|
| One Piece | 2,827 | 178 | 2,537 | 112 | PriceCharting JP + 0.7x bulk |
| Pokemon | 27,984 | 1,031 | — | ~27,000 | TCGdex (EN prices) |

### One Piece JP Price Verification by Set

| Set | Code | Top Card | JP Price |
|-----|------|----------|----------|
| Romance Dawn | OP01 | Nami Manga | ¥70,995 |
| Paramount War | OP02 | Ace Manga | ¥68,416 |
| Pillars of Strength | OP03 | Sogeking Manga | ¥53,212 |
| Kingdoms of Intrigue | OP04 | Sabo Manga | ¥55,276 |
| Awakening of the New Era | OP05 | Luffy Alt Art | ¥14,323 |
| Wings of the Captain | OP06 | Zoro Manga | ¥158,472 |
| 500 Years in the Future | OP07 | Boa Hancock Manga | ¥111,973 |
| Two Legends | OP08 | Rayleigh Manga | ¥54,375 |
| Emperors in the New World | OP09 | Roger Manga | ¥474,031 |
| Royal Blood | OP10 | Law Manga | ¥51,750 |
| Fist of Divine Speed | OP11 | Luffy Manga | ¥84,423 |
| Legacy of the Master | OP12 | Bonney Manga | ¥57,024 |
| Carrying on His Will | OP13 | Ace Red Manga | ¥272,617 |
| Azure Sea's Seven | OP14 | Mihawk Manga | ¥69,610 |
| Memorial Collection | EB01 | Chopper Manga | ¥100,050 |
| Anime 25th Collection | EB02 | Luffy Manga | ¥104,541 |
| Heroines Edition | EB03 | Uta Manga | ¥103,273 |
| Egghead Crisis | EB04 | Koby Manga | ¥89,811 |

### Pricing Strategy
- **Floor pricing**: Use lowest reliable source, not median
- **JP domestic target**: Not EN international prices
- **Bulk cards**: 0.7x discount applied to EN PriceCharting prices as JP estimate
- **Commons**: All reset to ¥50 floor (no hidden gem commons in JP market)
- **UC parallels**: Real flea market hidden gems, need individual verification

### Automated Scripts
- `scripts/fetch-amazon-jp.js` — Works for base cards only (variants return wrong prices)
- `scripts/fetch-mercari-jp.js` — Untested
- `scripts/fetch-yuyutei.js` — Untested
- `.github/workflows/update-jp-prices.yml` — Weekly auto-update (needs script refinement)

## Remaining Work
1. Run Amazon JP script on ~2,000 base cards (replace 0.7x estimates)
2. Test Mercari JP + Yuyu-tei scripts
3. Pokemon deep JP price check (same treatment as OP)
4. UC parallel spot-checks from Amazon JP
5. 112 cards with no price (promos, tournament prizes)

---

## Overview

Card prices come from free APIs. No paid services required.

## Pokemon Cards

**Source:** [TCGdex API](https://tcgdex.dev/markets-prices) (FREE, unlimited)

TCGdex aggregates prices from:
- **Cardmarket** (EUR) - Europe's largest TCG marketplace, updated daily
- **TCGPlayer** (USD) - North America's leading platform, updated hourly

### Data Structure
```json
{
  "pricing": {
    "cardmarket": {
      "unit": "EUR",
      "trend": 0.08,
      "avg30": 0.18,
      "low": 0.02
    },
    "tcgplayer": {
      "unit": "USD",
      "normal": { "marketPrice": 0.18, "lowPrice": 0.01 },
      "holofoil": { "marketPrice": 1.50 }
    }
  }
}
```

### Fetching Prices
```bash
# Fetch 1000 cards (run multiple times for full coverage)
cd /mnt/c/q/Pokemon && node scripts/fetch-prices.js 1000
```

The script:
- Works on shards directly (not brain-cache)
- Saves every 100 cards (safe to interrupt)
- Shows progress: `500/1000 (450 with prices)`
- ~28,000 total cards, ~100ms per card = ~45 min for full fetch

### Coverage
- Not all cards have prices (unlisted on marketplaces)
- Older/obscure cards may lack data
- Japanese-exclusive cards often missing from TCGPlayer

## One Piece Cards

**Source:** [one-piece-api.com](https://one-piece-api.com) via RapidAPI

### Pricing
- Free tier: 100 requests/day
- Pro: $9.90/mo for 3,000/day

### Data Structure
```json
{
  "prices": {
    "cardmarket": { "currency": "EUR", "lowest_near_mint": 7.50 },
    "tcgplayer": { "currency": "EUR", "market_price": 7.20 }
  }
}
```

### Fetching Prices
```bash
# Requires RAPIDAPI_KEY environment variable
cd /mnt/c/q/Pokemon && node scripts/fetch-onepiece-prices.js 100
```

### Challenges
- TCGdex is Pokemon-only
- TCGPlayer API closed to new developers
- Cardmarket API requires authentication

### Options Being Evaluated
1. **TCGAPIs** ($29/mo) - Covers One Piece, real-time pricing
2. **Manual entry** - For high-value cards only
3. **Scraping** - Legal gray area, maintenance burden

### Image Workaround
Bandai blocks cross-origin image requests. We proxy through wsrv.nl:
```javascript
const proxyImg = url => url?.startsWith('https://en.onepiece-cardgame.com') 
  ? `https://wsrv.nl/?url=${encodeURIComponent(url)}` 
  : url;
```

## Display Logic

`search.html` formatPrice() priority:
1. TCGPlayer USD (if currency=USD and available)
2. Cardmarket EUR trend (converted if needed)
3. Legacy `card.price.jpy` or `card.price.eur`
4. Returns `-` if no price data

### Currency Conversion
Static rates (updated manually):
- EUR → JPY: ×162
- EUR → USD: ×1.08
- JPY → USD: ×0.0067

## Maintenance

### Pokemon
- Run `fetch-prices.js` weekly to update prices
- TCGdex updates: Cardmarket daily, TCGPlayer hourly

### One Piece
- Currently no automated updates
- Manual price entry in `onepiece-cache.json` if needed

## Future Improvements

- [ ] Automate price fetching via GitHub Actions (weekly cron)
- [ ] Find free One Piece price source
- [ ] Add price history/trends
- [ ] Show "last updated" timestamp per card

---

## Price Source Reference

### Japan Domestic (for future integration #128-130)

| Source | URL | TCG | Type | Notes |
|--------|-----|-----|------|-------|
| Yuyu-tei (遊々亭) | yuyu-tei.jp | Both | Shop | Buy/sell prices. Reliable condition grading |
| Card Rush (カードラッシュ) | cardrush.jp | Both | Shop | Major Akihabara shop. Good buy prices |
| Mercari JP | jp.mercari.com | Both | Marketplace | Sold listings = real market value |
| Yahoo Auctions JP | auctions.yahoo.co.jp | Both | Auction | Good for rare cards |
| Suruga-ya (駿河屋) | suruga-ya.jp | Both | Shop | Retro/hobby. Deals on older sets |
| Amazon JP | amazon.co.jp | Both | Marketplace | Mixed sellers, prices vary |
| Magi (マギ) | magi.camp | Both | App | Card-specific trading app |
| Hareruya 2 (晴れる屋2) | hareruya2.com | OP | Shop | One Piece specialist |
| Bigweb | bigweb.co.jp | Both | Shop | Large online card shop |
| Rakuten | rakuten.co.jp | Both | Marketplace | Points system |

### Worldwide (current + potential)

| Source | URL | TCG | Status | Notes |
|--------|-----|-----|--------|-------|
| TCGdex | tcgdex.dev | PKM | ✅ Active | Free API. Our Pokemon source |
| limitlesstcg | limitlesstcg.com | OP | ✅ Active | Our One Piece source |
| TCGPlayer | tcgplayer.com | Both | 🔗 Links only | US marketplace |
| Cardmarket | cardmarket.com | Both | 🔗 Links only | EU marketplace |
| PriceCharting | pricecharting.com | Both | 🔗 Links only | Best historical data |
| eBay | ebay.com | Both | 🔗 Links only | Global auction |

---

## Pricing Strategy: Learnings from OP01-120 Manual Test (2026-03-26)

### Key Finding: JP vs EN Price Gap
The same card (OP01-120 Shanks SEC) has wildly different prices depending on market:
- **EN international (limitlesstcg/TCGPlayer):** $7.95 → ¥1,193
- **JP domestic (PriceCharting JP):** $2.66 → ¥399
- **JP floor (eBay sold):** $0.99-$1.14 → ¥149-171

Our previous source (limitlesstcg) was **3x overpriced** for JP cards because it indexes on EN/international demand.

### Decision: Use Floor Pricing
For a flea market price guide, **floor price** is the right index:
- Users need to know "is this a deal?" → compare against the cheapest available
- Floor = lowest reliable sold price (exclude obvious outliers like $0.99 auction starts)
- PriceCharting JP ungraded is the best proxy for floor (aggregates eBay JP sold listings)

### Price Source Priority (for automation)
1. **PriceCharting JP** — best for JP cards, sold-listing based, high volume
2. **Mercari JP sold** — most realistic JP domestic price (if we can scrape)
3. **Cardmarket trend** — good EU benchmark, sometimes cheaper than US
4. **limitlesstcg** — current source, EN-biased, use as ceiling/reference only
5. **TCGPlayer** — US retail, highest prices, least relevant for JP flea market

### Display Strategy
- **Tile:** Show floor price (lowest source)
- **Modal:** Show all sources with floor highlighted
- **Color coding:** Green = below floor (great deal), Red = above ceiling

### Data Model for Multi-Source (when automated)
```json
{
  "pricing": {
    "floor": 399,
    "sources": {
      "pricecharting_jp": { "usd": 2.66, "jpy": 399, "updated": "2026-03-26", "volume": "1/day" },
      "limitlesstcg": { "usd": 7.95, "jpy": 1193, "updated": "2026-03-22" },
      "cardmarket": { "eur": 1.90, "jpy": 310, "updated": "2026-03-26" }
    }
  }
}
```

### Automation Requirements
- PriceCharting has an API ($6/month pro, or scrape free pages)
- Need separate JP and EN price tracking per card
- Daily snapshot should capture floor from all sources
- Flag cards where JP price < 50% of EN price (arbitrage opportunities for users)
