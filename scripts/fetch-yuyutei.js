#!/usr/bin/env node
/**
 * Yuyu-tei Price Fetcher for One Piece TCG cards
 * 
 * Usage: node scripts/fetch-yuyutei.js [card_ids...]
 * 
 * Fetches buy and sell prices from yuyu-tei.jp (major JP card shop).
 * Buy price = what they pay you (floor/buylist price)
 * Sell price = what you pay them (retail)
 * 
 * Requirements: npm install puppeteer
 * 
 * Output: Updates data/onepiece-cache.json with yuyutei pricing field
 */

const fs = require('fs');
const path = require('path');

const DELAY_MS = 3000;
const MAX_CARDS = 50;

async function fetchYuyuteiPrice(page, cardId) {
  const query = encodeURIComponent(cardId);
  const url = `https://yuyu-tei.jp/sell/op/s/${query}`;
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    
    // Extract sell price (retail) and buy price (buylist)
    const prices = await page.evaluate(() => {
      const sellEl = document.querySelector('.price, .sell-price, [class*="price"]');
      const buyEl = document.querySelector('.buy-price, [class*="buy"]');
      return {
        sell: sellEl ? parseInt(sellEl.textContent.replace(/[¥,円]/g, '')) : null,
        buy: buyEl ? parseInt(buyEl.textContent.replace(/[¥,円]/g, '')) : null
      };
    });
    
    if (prices.sell || prices.buy) {
      console.log(`  ✅ ${cardId}: sell ¥${(prices.sell || '?').toLocaleString()}, buy ¥${(prices.buy || '?').toLocaleString()}`);
      return {
        jpy_sell: prices.sell,
        jpy_buy: prices.buy,
        url,
        updated: new Date().toISOString().split('T')[0]
      };
    } else {
      console.log(`  ❌ ${cardId}: no price found`);
      return null;
    }
  } catch (e) {
    console.log(`  ⚠️ ${cardId}: error - ${e.message}`);
    return null;
  }
}

async function main() {
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch (e) {
    console.error('puppeteer not installed. Run: npm install puppeteer');
    process.exit(1);
  }

  const cachePath = path.join(__dirname, '../data/onepiece-cache.json');
  const data = JSON.parse(fs.readFileSync(cachePath));
  
  let targetIds = process.argv.slice(2);
  if (!targetIds.length) {
    const allCards = Object.values(data.sets).flat();
    allCards.sort((a, b) => (b.pricing?.usd || 0) - (a.pricing?.usd || 0));
    targetIds = allCards.slice(0, MAX_CARDS).map(c => c.id);
  }
  
  console.log(`Fetching Yuyu-tei prices for ${targetIds.length} cards...\n`);
  
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  let updated = 0;
  for (const cardId of targetIds) {
    let card = null;
    for (const [setId, cards] of Object.entries(data.sets)) {
      card = cards.find(c => c.id === cardId);
      if (card) break;
    }
    if (!card) continue;
    
    const result = await fetchYuyuteiPrice(page, cardId);
    if (result) {
      if (!card.pricing) card.pricing = {};
      card.pricing.yuyutei = result;
      updated++;
    }
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
  
  await browser.close();
  fs.writeFileSync(cachePath, JSON.stringify(data));
  console.log(`\n✅ Updated ${updated}/${targetIds.length} cards with Yuyu-tei prices`);
}

main().catch(console.error);
