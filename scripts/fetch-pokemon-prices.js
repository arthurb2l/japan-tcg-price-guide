#!/usr/bin/env node
// Fetch Pokemon prices from limitlesstcg.com
// Usage: node fetch-pokemon-prices.js [setId] [--all]

const fs = require('fs');
const path = require('path');

const SHARDS_DIR = path.join(__dirname, '../data/shards');
const DELAY = 300; // ms between requests

// Map our set IDs to limitlesstcg set codes
const SET_MAP = {
  // SWSH English sets -> limitlesstcg codes
  'swsh1': 'SSH', 'swsh2': 'RCL', 'swsh3': 'DAA', 'swsh3.5': 'CPA',
  'swsh4': 'VIV', 'swsh4.5': 'SHF', 'swsh5': 'BST', 'swsh6': 'CRE',
  'swsh7': 'EVS', 'swsh8': 'FST', 'swsh9': 'BRS', 'swsh10': 'ASR',
  'swsh10.5': 'PGO', 'swsh11': 'LOR', 'swsh12': 'SIT', 'swsh12.5': 'CRZ',
  'swshp': 'SWP',
  // XY English sets
  'xy1': 'XY', 'xy2': 'FLF', 'xy3': 'FFI', 'xy4': 'PHF', 'xy5': 'PRC',
  'xy6': 'ROS', 'xy7': 'AOR', 'xy8': 'BKT', 'xy9': 'BKP', 'xy10': 'FCO',
  'xy11': 'STS', 'xy12': 'EVO',
  // BW English sets
  'bw1': 'BLW', 'bw2': 'EPO', 'bw3': 'NVI', 'bw4': 'NXD', 'bw5': 'DEX',
  'bw6': 'DRX', 'bw7': 'BCR', 'bw8': 'PLS', 'bw9': 'PLF', 'bw10': 'PLB',
  'bw11': 'LTR',
  // SM English sets
  'sm1': 'SUM', 'sm2': 'GRI', 'sm3': 'BUS', 'sm3.5': 'SLG', 'sm4': 'CIN',
  'sm5': 'UPR', 'sm6': 'FLI', 'sm7': 'CES', 'sm7.5': 'DRM', 'sm8': 'LOT',
  'sm9': 'TEU', 'sm10': 'UNB', 'sm11': 'UNM', 'sm115': 'HIF', 'sm12': 'CEC',
  'sma': 'DET', 'smp': 'SMP',
};

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

async function getEnglishCardLink(jpSetId, cardNum) {
  // Check if we have a direct mapping to English set
  const mappedSet = SET_MAP[jpSetId] || SET_MAP[jpSetId.toLowerCase()];
  if (mappedSet) {
    // Try direct English lookup
    const url = `https://limitlesstcg.com/cards/${mappedSet}/${cardNum}`;
    try {
      const html = await fetchWithRetry(url);
      if (!html.includes('Page not found')) {
        return `${mappedSet}/${cardNum}`;
      }
    } catch (e) {}
  }
  
  // Try to find English equivalent via Japanese card page
  const setVariants = [jpSetId, jpSetId.toUpperCase(), jpSetId.toLowerCase()];
  
  for (const setVar of setVariants) {
    const url = `https://limitlesstcg.com/cards/jp/${setVar}/${cardNum}`;
    try {
      const html = await fetchWithRetry(url);
      if (html.includes('Page not found')) continue;
      // Look for English card link
      const match = html.match(/href="\/cards\/en\/([^"]+)"/);
      if (match) return match[1]; // e.g., "DRI/4"
    } catch (e) {}
  }
  return null;
}

async function getPriceFromEnglishCard(enPath) {
  const url = `https://limitlesstcg.com/cards/en/${enPath}`;
  try {
    const html = await fetchWithRetry(url);
    // Extract USD price
    const usdMatch = html.match(/class="card-price usd"[^>]*>\$([0-9,]+\.[0-9]+)/);
    const eurMatch = html.match(/class="card-price eur"[^>]*>([0-9,]+\.[0-9]+)€/);
    if (usdMatch) {
      return {
        usd: parseFloat(usdMatch[1].replace(',', '')),
        eur: eurMatch ? parseFloat(eurMatch[1].replace(',', '')) : null,
        source: 'limitlesstcg',
        updated: new Date().toISOString().split('T')[0]
      };
    }
  } catch (e) {}
  return null;
}

async function processSet(shard, setId, cards) {
  console.log(`\nProcessing ${setId} (${cards.length} cards)...`);
  let updated = 0;
  
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    // Skip if already has limitlesstcg price
    if (card.pricing?.source === 'limitlesstcg') continue;
    
    // Extract card number from ID (e.g., "SV10-001" -> "1")
    const numMatch = card.id.match(/-0*(\d+)$/);
    if (!numMatch) continue;
    const cardNum = numMatch[1];
    
    // Find English equivalent
    const enPath = await getEnglishCardLink(setId, cardNum);
    if (!enPath) {
      await new Promise(r => setTimeout(r, DELAY));
      continue;
    }
    
    // Get price
    const pricing = await getPriceFromEnglishCard(enPath);
    if (pricing) {
      card.pricing = pricing;
      updated++;
      process.stdout.write(`\r  ${i+1}/${cards.length} - ${updated} prices found`);
    }
    
    await new Promise(r => setTimeout(r, DELAY));
  }
  
  console.log(`\n  Done: ${updated} prices added`);
  return updated;
}

async function main() {
  const args = process.argv.slice(2);
  const targetSet = args.find(a => !a.startsWith('-'));
  const processAll = args.includes('--all');
  
  // Load all shards
  const shardFiles = fs.readdirSync(SHARDS_DIR).filter(f => f.endsWith('.json') && f !== 'manifest.json');
  
  let totalUpdated = 0;
  
  for (const shardFile of shardFiles) {
    const shardPath = path.join(SHARDS_DIR, shardFile);
    const shard = JSON.parse(fs.readFileSync(shardPath, 'utf8'));
    let shardUpdated = 0;
    
    for (const setId of Object.keys(shard.sets || {})) {
      // Skip if not target set (when specified)
      if (targetSet && setId !== targetSet) continue;
      if (!processAll && !targetSet) {
        console.log(`Skipping ${setId} (use --all or specify set)`);
        continue;
      }
      
      const updated = await processSet(shard, setId, shard.sets[setId]);
      shardUpdated += updated;
    }
    
    if (shardUpdated > 0) {
      fs.writeFileSync(shardPath, JSON.stringify(shard, null, 2));
      console.log(`Saved ${shardFile}`);
    }
    totalUpdated += shardUpdated;
  }
  
  console.log(`\nTotal: ${totalUpdated} prices updated`);
}

main().catch(console.error);
