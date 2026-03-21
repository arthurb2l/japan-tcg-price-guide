#!/usr/bin/env node
// Fetch the sets that were missed due to timeout

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SHARDS_DIR = path.join(__dirname, '../data/shards');

function curlGet(url) {
  try {
    const result = execSync(`curl -s --connect-timeout 10 "${url}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    return JSON.parse(result);
  } catch (e) {
    return null;
  }
}

function main() {
  // Sets that need to be added
  const setsToFetch = {
    'vintage.json': ['E1', 'E2', 'E3', 'E4', 'E5', 'web1'],
    'ex.json': ['PCG1', 'PCG2', 'PCG3', 'PCG4', 'PCG5', 'PCG6', 'PCG7', 'PCG8', 'PCG9', 'PMCG1', 'PMCG2', 'PMCG3', 'PMCG4', 'PMCG5', 'PMCG6'],
    'swsh.json': ['S9', 'S9a', 'S12', 'S12a']
  };

  let totalAdded = 0;

  for (const [shardFile, sets] of Object.entries(setsToFetch)) {
    const shardPath = path.join(SHARDS_DIR, shardFile);
    const shard = JSON.parse(fs.readFileSync(shardPath, 'utf8'));
    
    for (const setId of sets) {
      if (shard.sets[setId]) {
        console.log(`${setId}: exists`);
        continue;
      }
      
      process.stdout.write(`${setId}... `);
      
      const setData = curlGet(`https://api.tcgdex.net/v2/ja/sets/${setId}`);
      if (!setData || !setData.cards) {
        console.log('no data');
        continue;
      }

      const cards = [];
      for (const cardRef of setData.cards) {
        const card = curlGet(`https://api.tcgdex.net/v2/ja/cards/${cardRef.id}`);
        if (card && card.id) {
          cards.push({
            id: card.id,
            name: card.name,
            nameJp: card.name,
            set: setId,
            setName: setData.name,
            rarity: card.rarity || 'Unknown',
            img: card.image ? `${card.image}/high.webp` : null,
            hp: card.hp,
            types: card.types,
            source: 'tcgdex'
          });
        }
      }

      if (cards.length > 0) {
        shard.sets[setId] = cards;
        console.log(`✅ ${cards.length}`);
        totalAdded += cards.length;
      }
    }
    
    // Save this shard
    fs.writeFileSync(shardPath, JSON.stringify(shard, null, 2));
    console.log(`Saved ${shardFile}`);
  }

  // Update manifest
  const shards = {};
  for (const file of fs.readdirSync(SHARDS_DIR)) {
    if (file === 'manifest.json') continue;
    shards[file] = JSON.parse(fs.readFileSync(path.join(SHARDS_DIR, file), 'utf8'));
  }
  
  const manifest = { lastUpdated: new Date().toISOString(), shards: {} };
  for (const [file, data] of Object.entries(shards)) {
    manifest.shards[file.replace('.json', '')] = {
      file,
      cards: Object.values(data.sets).flat().length,
      sets: Object.keys(data.sets).length,
      size: JSON.stringify(data).length
    };
  }
  fs.writeFileSync(path.join(SHARDS_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`\n✅ Added ${totalAdded} cards total`);
}

main();
