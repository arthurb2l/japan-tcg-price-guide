# Japanese Price Sources for One Piece TCG

## Research Date: 2025-03-23

## Working Sources (Need Browser/JS)

### 1. Yuyu-tei (遊々亭)
- **URL Pattern:** `https://yuyu-tei.jp/sell/opc/s/op09`
- **Game Code:** `opc` (One Piece Card)
- **Status:** ⚠️ JS-rendered, needs browser automation
- **Data Found:** Card IDs, names, rarity (OP09-004 P-SR シャンクス)
- **Notes:** Popular JP card shop, good prices, but page loads via JavaScript

### 2. Suruga-ya (駿河屋)
- **URL Pattern:** `https://www.suruga-ya.jp/search?category=5&search_word=OP09`
- **Category 5:** Trading cards
- **Status:** ⚠️ Partial - many cards show "品切れ" (sold out)
- **Data Found:** Card IDs with rarity [SR], [SP], [SEC], names
- **Price Class:** `<p class="price">` contains price or "品切れ"
- **Notes:** Large inventory but stock varies

### 3. Cardrush
- **URL Pattern:** `https://www.cardrush-dm.jp/product-list?keyword=OP09-004`
- **Status:** ⚠️ JS-rendered
- **Notes:** Needs browser automation

### 4. Bigweb
- **URL Pattern:** `https://www.bigweb.co.jp/ja/products/op/search?name=OP09-004`
- **Status:** ⚠️ JS-rendered
- **Notes:** Needs browser automation

## Non-Working Sources

### Limitlesstcg
- **URL:** `https://onepiece.limitlesstcg.com/cards/OP09/004`
- **Status:** ❌ 500 Server Error (as of 2025-03-23)
- **Notes:** Was working before, may recover

### TCGPlayer
- **URL:** `https://www.tcgplayer.com/search/one-piece-card-game/product?q=OP09-004`
- **Status:** ❌ JS-rendered, anti-scraping
- **Notes:** US prices, not JP

### Cardmarket
- **URL:** `https://www.cardmarket.com/en/OnePiece/Products/Singles/...`
- **Status:** ❌ JS-rendered
- **Notes:** EU prices, not JP

### Mercari API
- **URL:** `https://api.mercari.jp/search/v1/search?keyword=OP09-004`
- **Status:** ❌ Returns "Forbidden"
- **Notes:** Needs authentication

## Browser Automation Required

To scrape JP shops, need Chrome with remote debugging:
```bash
# Start Chrome with debugging
google-chrome --remote-debugging-port=9222 &

# Or on Windows/WSL:
"/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" --remote-debugging-port=9222
```

Then use Chrome DevTools MCP or Puppeteer to:
1. Navigate to price page
2. Wait for JS to load
3. Extract prices from DOM

## Price Data Structure

When we get prices, store in this format:
```json
{
  "pricing": {
    "jp": {
      "price": 1500,
      "currency": "JPY",
      "source": "yuyu-tei",
      "updated": "2025-03-23"
    }
  }
}
```

## Next Steps

1. [ ] Set up browser automation (Puppeteer or Chrome DevTools MCP)
2. [ ] Create scraper for yuyu-tei (best JP source)
3. [ ] Add fallback to suruga-ya
4. [ ] Store JP prices in onepiece-cache.json
5. [ ] Display JP prices on card tiles (¥ format)
