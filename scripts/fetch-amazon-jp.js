#!/usr/bin/env node
/**
 * Amazon JP Price Fetcher for One Piece TCG cards
 * 
 * Usage: node scripts/fetch-amazon-jp.js [card_ids...]
 * Example: node scripts/fetch-amazon-jp.js OP01-120 OP01-016
 * 
 * Without args: fetches prices for top 50 most valuable cards
 * 
 * Requirements: npm install puppeteer
 * 
 * Output: Updates data/onepiece-cache.json with amazonjp pricing field
 * 
 * NOTE: This script requires a headless browser (puppeteer) because
 * Amazon JP blocks simple HTTP requests. Run locally or via GitHub Actions.
 */

const fs = require('fs');
const path = require('path');

// Config
const DELAY_MS = 3000; // Delay between requests to avoid rate limiting
const MAX_CARDS = 200;

async function fetchAmazonJPPrice(page, cardId, cardName) {
  const query = encodeURIComponent(`${cardId} ワンピースカード シングル`);
  const url = `https://www.amazon.co.jp/s?k=${query}&rh=p_36%3A-50000`;
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));
    
    // Extract prices, skip pack/box MSRPs
    const packPrices = [220, 550, 990, 1320, 1650, 1980, 3300, 5280, 5500, 9900];
    const price = await page.evaluate((skipPrices) => {
      const els = document.querySelectorAll('.a-price-whole');
      for (const el of els) {
        const p = parseInt(el.textContent.replace(/,/g, ''));
        if (p > 0 && !skipPrices.includes(p)) return p;
      }
      return null;
    }, packPrices);
    
    if (price && price > 0) {
      console.log(`  ✅ ${cardId}: ¥${price.toLocaleString()}`);
      return { jpy: price, url, updated: new Date().toISOString().split('T')[0] };
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
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    console.error('puppeteer not installed. Run: npm install puppeteer');
    console.error('This script requires a headless browser to fetch Amazon JP prices.');
    process.exit(1);
  }

  // Load card data
  const cachePath = path.join(__dirname, '../data/onepiece-cache.json');
  const data = JSON.parse(fs.readFileSync(cachePath));
  
  // Get cards to fetch
  let targetIds = process.argv.slice(2);
  
  if (!targetIds.length) {
    // Default: top 50 most valuable cards
    const allCards = Object.values(data.sets).flat();
    allCards.sort((a, b) => (b.pricing?.usd || 0) - (a.pricing?.usd || 0));
    targetIds = allCards.filter(c => !c.id.includes("-p") && !c.id.includes("-aa")).slice(0, MAX_CARDS).map(c => c.id);
    console.log(`Fetching top ${MAX_CARDS} cards by value...`);
  }
  
  console.log(`Fetching Amazon JP prices for ${targetIds.length} cards...\n`);
  
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  
  let updated = 0;
  for (const cardId of targetIds) {
    // Find card in data
    let card = null;
    for (const [setId, cards] of Object.entries(data.sets)) {
      card = cards.find(c => c.id === cardId);
      if (card) break;
    }
    if (!card) { console.log(`  ⏭️ ${cardId}: not found in data`); continue; }
    
    const result = await fetchAmazonJPPrice(page, cardId, card.name);
    if (result) {
      if (!card.pricing) card.pricing = {};
      card.pricing.amazonjp = result;
      updated++;
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
  
  await browser.close();
  
  // Save
  fs.writeFileSync(cachePath, JSON.stringify(data));
  console.log(`\n✅ Updated ${updated}/${targetIds.length} cards with Amazon JP prices`);
}

main().catch(console.error);
