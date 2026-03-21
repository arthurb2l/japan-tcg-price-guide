#!/usr/bin/env node
// Fetch Japanese SV sets (different from English sv01, sv02, etc.)

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
  // Japanese SV sets (different IDs from English)
  const jpSets = [
    'SV1S', 'SV1V', 'SV2D', 'SV2P', 'SV2a', 'SV3', 'SV3a',
    'SV4K', 'SV4M', 'SV4a', 'SV5K', 'SV5a', 'SV6', 'SV7'
  ];

  const shardPath = path.join(SHARDS_DIR, 'sv.json');
  const shard = JSON.parse(fs.readFileSync(shardPath, 'utf8'));
  
  let totalAdded = 0;

  for (const setId of jpSets) {
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
  
  // Save
  fs.writeFileSync(shardPath, JSON.stringify(shard, null, 2));

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

  console.log(`\n✅ Added ${totalAdded} Japanese SV cards`);
}

main();
