#!/usr/bin/env node
/**
 * Fetch rarity (+ images if missing) from TCGdex for Pokemon cards
 * Usage: node scripts/fetch-pokemon-metadata.js [shard] [limit]
 */
const fs = require('fs');
const path = require('path');
const SHARDS_DIR = path.join(__dirname, '..', 'data', 'shards');

async function main() {
  const targetShard = process.argv[2] || 'all';
  const limit = parseInt(process.argv[3]) || 2000;
  
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
        const needsRarity = !card.rarity;
        const needsImage = !card.image && !card.imageUrl;
        if (!needsRarity && !needsImage) continue;
        
        try {
          const res = await fetch(`https://api.tcgdex.net/v2/en/cards/${card.id}`);
          if (res.ok) {
            const d = await res.json();
            let changed = false;
            if (needsRarity && d.rarity) { card.rarity = d.rarity; changed = true; }
            if (needsImage && d.image) { card.image = d.image; changed = true; }
            if (changed) { updated++; total++; }
            if (updated % 100 === 0 && updated > 0) {
              process.stdout.write(`  ${file}: ${updated} updated...\n`);
              fs.writeFileSync(fp, JSON.stringify(shard));
            }
          }
        } catch {}
        await new Promise(r => setTimeout(r, 100));
      }
      if (total >= limit) break;
    }
    
    fs.writeFileSync(fp, JSON.stringify(shard));
    if (updated) console.log(`${file}: ${updated} cards updated`);
  }
  console.log(`\n✅ Total: ${total} cards with new metadata`);
}
main().catch(console.error);
