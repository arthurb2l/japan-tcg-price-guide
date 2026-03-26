#!/usr/bin/env node
/**
 * Mercari JP Sold Price Fetcher for One Piece TCG cards
 * 
 * Usage: node scripts/fetch-mercari-jp.js [card_ids...]
 * 
 * Fetches SOLD listing prices from Mercari JP (completed transactions).
 * These represent actual market value, not asking prices.
 * 
 * Requirements: npm install puppeteer
 * 
 * Output: Updates data/onepiece-cache.json with mercari pricing field
 */

const fs = require('fs');
const path = require('path');

const DELAY_MS = 4000;
const MAX_CARDS = 50;

async function fetchMercariPrice(page, cardId) {
  const query = encodeURIComponent(`${cardId} ワンピース カード`);
  // status=sold_out filters to completed sales only
  const url = `https://jp.mercari.com/search?keyword=${query}&status=sold_out&sort=created_time&order=desc`;
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 3000));
    
    // Extract prices from sold listings
    const prices = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-testid="item-cell"]');
      const results = [];
      items.forEach(item => {
        const priceEl = item.querySelector('[class*="price"], [class*="Price"]');
        if (priceEl) {
          const price = parseInt(priceEl.textContent.replace(/[¥,]/g, ''));
          if (price > 0) results.push(price);
        }
      });
      return results.slice(0, 5); // Last 5 sold prices
    });
    
    if (prices.length) {
      const floor = Math.min(...prices);
      const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
      console.log(`  ✅ ${cardId}: floor ¥${floor.toLocaleString()}, avg ¥${avg.toLocaleString()} (${prices.length} sold)`);
      return { jpy: floor, avg, sold: prices.length, url, updated: new Date().toISOString().split('T')[0] };
    } else {
      console.log(`  ❌ ${cardId}: no sold listings`);
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
  
  console.log(`Fetching Mercari JP sold prices for ${targetIds.length} cards...\n`);
  
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  
  let updated = 0;
  for (const cardId of targetIds) {
    let card = null;
    for (const [setId, cards] of Object.entries(data.sets)) {
      card = cards.find(c => c.id === cardId);
      if (card) break;
    }
    if (!card) continue;
    
    const result = await fetchMercariPrice(page, cardId);
    if (result) {
      if (!card.pricing) card.pricing = {};
      card.pricing.mercari = result;
      updated++;
    }
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
  
  await browser.close();
  fs.writeFileSync(cachePath, JSON.stringify(data));
  console.log(`\n✅ Updated ${updated}/${targetIds.length} cards with Mercari JP prices`);
}

main().catch(console.error);
