#!/usr/bin/env node
// Fetch prices from TCGdex for Pokemon cards in shards
// Run incrementally - fetches cards without prices

const fs = require('fs');
const path = require('path');

const SHARD_DIR = path.join(__dirname, '../data/shards');
const BATCH_SIZE = parseInt(process.argv[2]) || 100;
const DELAY = 100;

async function fetchPrice(cardId, retries = 2) {
  const url = `https://api.tcgdex.net/v2/en/cards/${cardId}`;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return null;
      const data = await res.json();
      return data.pricing || null;
    } catch (e) {
      if (i === retries) return null;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function run() {
  const manifest = JSON.parse(fs.readFileSync(path.join(SHARD_DIR, 'manifest.json'), 'utf8'));
  
  // Collect all cards needing prices
  let needsPrices = [];
  const shardData = {};
  
  for (const [era, info] of Object.entries(manifest.shards)) {
    const shard = JSON.parse(fs.readFileSync(path.join(SHARD_DIR, info.file), 'utf8'));
    shardData[era] = shard;
    for (const [setId, cards] of Object.entries(shard.sets)) {
      for (const card of cards) {
        if (!card.pricing) needsPrices.push({ era, setId, card });
      }
    }
  }
  
  const total = Object.values(manifest.shards).reduce((s, i) => s + i.cards, 0);
  console.log(`Total cards: ${total}`);
  console.log(`Cards without prices: ${needsPrices.length}`);
  console.log(`Fetching ${Math.min(BATCH_SIZE, needsPrices.length)} cards...\n`);
  
  let fetched = 0, found = 0;
  const modifiedShards = new Set();
  
  for (const { era, card } of needsPrices.slice(0, BATCH_SIZE)) {
    const pricing = await fetchPrice(card.id);
    if (pricing) {
      card.pricing = pricing;
      found++;
      modifiedShards.add(era);
    }
    fetched++;
    if (fetched % 10 === 0) process.stdout.write(`\r${fetched}/${Math.min(BATCH_SIZE, needsPrices.length)} (${found} with prices)`);
    
    // Save every 100 cards
    if (fetched % 100 === 0 && modifiedShards.size > 0) {
      for (const e of modifiedShards) {
        fs.writeFileSync(path.join(SHARD_DIR, manifest.shards[e].file), JSON.stringify(shardData[e]));
      }
    }
    await new Promise(r => setTimeout(r, DELAY));
  }
  
  console.log(`\n\nFetched ${fetched} cards, ${found} had prices`);
  
  // Save modified shards
  for (const era of modifiedShards) {
    const file = manifest.shards[era].file;
    fs.writeFileSync(path.join(SHARD_DIR, file), JSON.stringify(shardData[era]));
    console.log(`Saved ${file}`);
  }
  
  const remaining = needsPrices.length - fetched;
  if (remaining > 0) console.log(`\nRemaining: ${remaining} cards. Run again to continue.`);
}

run().catch(console.error);
