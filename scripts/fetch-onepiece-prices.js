#!/usr/bin/env node
// Fetch One Piece prices from limitlesstcg.com (free, no API key)

const fs = require('fs');
const path = require('path');

const CACHE = path.join(__dirname, '../data/onepiece-cache.json');
const BATCH_SIZE = parseInt(process.argv[2]) || 50;
const DELAY = 500; // Be nice to their server

async function fetchPrice(cardId) {
  const url = `https://onepiece.limitlesstcg.com/cards/${cardId}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const html = await res.text();
    
    // Extract USD and EUR prices from HTML
    const usdMatch = html.match(/class="card-price usd"[^>]*>([^<]+)</);
    const eurMatch = html.match(/class="card-price eur"[^>]*>([^<]+)</);
    
    if (!usdMatch && !eurMatch) return null;
    
    return {
      usd: usdMatch ? parseFloat(usdMatch[1].replace('$', '')) : null,
      eur: eurMatch ? parseFloat(eurMatch[1].replace('€', '')) : null,
      source: 'limitlesstcg',
      updated: new Date().toISOString().split('T')[0]
    };
  } catch { return null; }
}

async function run() {
  const data = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  const allCards = Object.values(data.sets).flat();
  const needsPrices = allCards.filter(c => !c.pricing);
  
  console.log(`Total: ${allCards.length} | Without prices: ${needsPrices.length}`);
  console.log(`Fetching ${Math.min(BATCH_SIZE, needsPrices.length)} cards...\n`);
  
  let fetched = 0, found = 0;
  
  for (const card of needsPrices.slice(0, BATCH_SIZE)) {
    const pricing = await fetchPrice(card.id);
    if (pricing) {
      card.pricing = pricing;
      found++;
    }
    fetched++;
    process.stdout.write(`\r${fetched}/${Math.min(BATCH_SIZE, needsPrices.length)} (${found} with prices)`);
    await new Promise(r => setTimeout(r, DELAY));
  }
  
  console.log(`\n\nFetched ${fetched}, found ${found} with prices`);
  fs.writeFileSync(CACHE, JSON.stringify(data, null, 2));
  console.log('Saved to onepiece-cache.json');
  
  const remaining = needsPrices.length - fetched;
  if (remaining > 0) console.log(`\nRemaining: ${remaining} cards`);
}

run().catch(console.error);
