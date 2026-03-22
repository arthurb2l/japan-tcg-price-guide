# Pricing Data Sources

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

**Source:** None currently (researching options)

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
