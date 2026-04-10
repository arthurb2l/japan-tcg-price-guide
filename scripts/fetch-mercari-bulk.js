#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const CACHE_PATH = path.join(__dirname, '../data/onepiece-cache.json');
const DELAY_MS = 4000;

async function fetchMercariPrice(page, cardId) {
  const query = encodeURIComponent(cardId + ' ワンピース カード');
  const url = `https://jp.mercari.com/search?keyword=${query}&status=sold_out&sort=created_time&order=desc`;
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
    await new Promise(r => setTimeout(r, 2500));
    
    const prices = await page.evaluate(() => {
      const yenMatches = document.body.innerText.match(/¥([0-9,]+)/g);
      if (!yenMatches) return [];
      return yenMatches.slice(0, 6).map(y => parseInt(y.replace(/[¥,]/g, '')));
    });
    
    if (prices.length >= 2) {
      // Use median of first few sold prices
      prices.sort((a, b) => a - b);
      const median = prices[Math.floor(prices.length / 2)];
      return { jpy: median, usd: Math.round(median / 150 * 100) / 100 };
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function main() {
  const data = JSON.parse(fs.readFileSync(CACHE_PATH));
  
  // Get SR/SEC/L/SP cards that only have estimates
  const targets = [];
  for (const [setId, cards] of Object.entries(data.sets)) {
    for (const card of cards) {
      const p = card.pricing || {};
      const rarity = card.rarity || '';
      if (['SR', 'SEC', 'L', 'SP', 'TR'].includes(rarity) && 
          (p.source === 'rarity-estimate' || p.source === 'unknown')) {
        targets.push({ id: card.id, rarity, card });
      }
    }
  }
  
  console.log(`High-value cards needing real prices: ${targets.length}`);
  
  const browser = await puppeteer.launch({ 
    headless: 'new', 
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
  
  let updated = 0;
  for (let i = 0; i < targets.length; i++) {
    const { id, rarity, card } = targets[i];
    const result = await fetchMercariPrice(page, id);
    
    if (result && result.jpy > 0) {
      card.pricing = {
        jpy: result.jpy,
        usd: result.usd,
        source: 'mercari-sold',
        updated: new Date().toISOString().split('T')[0],
        confidence: 'medium'
      };
      updated++;
      console.log(`  ✅ ${id} (${rarity}): ¥${result.jpy} ($${result.usd})`);
    } else {
      console.log(`  ⏭️ ${id} (${rarity}): no sold data`);
    }
    
    if ((i + 1) % 25 === 0) {
      console.log(`\n--- Progress: ${i + 1}/${targets.length} (${updated} updated) ---\n`);
      fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 0));
    }
    
    await new Promise(r => setTimeout(r, DELAY_MS));
  }
  
  await browser.close();
  fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 0));
  console.log(`\n✅ Done! Updated ${updated}/${targets.length} high-value cards with Mercari sold prices`);
}

main().catch(console.error);
