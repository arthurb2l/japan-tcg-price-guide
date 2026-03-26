#!/usr/bin/env node
/**
 * Pokemon TCGdex Price Fetcher
 * Usage: node scripts/fetch-pokemon-prices.js [shard] [limit]
 */
const fs = require('fs');
const path = require('path');
const SHARDS_DIR = path.join(__dirname, '..', 'data', 'shards');
const DELAY_MS = 100;

async function main() {
  const targetShard = process.argv[2] || 'all';
  const limit = parseInt(process.argv[3]) || 500;
  
  const files = fs.readdirSync(SHARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'manifest.json')
    .filter(f => targetShard === 'all' || f.replace('.json','') === targetShard);
  
  let total = 0;
  for (const file of files) {
    const fp = path.join(SHARDS_DIR, file);
    const shard = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const sets = shard.sets || shard;
    let updated = 0;
    
    for (const [setId, cards] of Object.entries(sets)) {
      if (!Array.isArray(cards)) continue;
      for (const card of cards) {
        if (total >= limit) break;
        if (card.pricing?.tcgplayer || card.pricing?.cardmarket) continue;
        
        try {
          const res = await fetch(`https://api.tcgdex.net/v2/en/cards/${card.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.pricing) {
              card.pricing = { ...card.pricing, ...data.pricing };
              updated++; total++;
              if (updated % 100 === 0) {
                process.stdout.write(`  ${file}: ${updated} fetched...\n`);
                fs.writeFileSync(fp, JSON.stringify(shard));
              }
            }
          }
        } catch {}
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
      if (total >= limit) break;
    }
    
    fs.writeFileSync(fp, JSON.stringify(shard));
    console.log(`${file}: ${updated} cards updated`);
  }
  console.log(`\n✅ Total: ${total} Pokemon cards with prices`);
}
main().catch(console.error);
