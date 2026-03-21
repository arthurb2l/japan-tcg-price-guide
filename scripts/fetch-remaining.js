#!/usr/bin/env node
// Fetch remaining Pokemon sets

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

function getShardFile(setId) {
  const id = setId.toLowerCase();
  if (id.startsWith('sv')) return 'sv.json';
  if (id.startsWith('s') && /^s\d/.test(id)) return 'swsh.json';
  return 'vintage.json';
}

function main() {
  const missingSets = ['SV7a', 'SV8', 'SV8a', 'SV9', 'SV9a', 'SV10', 'SV11W', 'SVK', 'SVLN', 'SVLS', 'VS1', 'web1'];

  const shards = {};
  for (const file of fs.readdirSync(SHARDS_DIR)) {
    if (file === 'manifest.json') continue;
    shards[file] = JSON.parse(fs.readFileSync(path.join(SHARDS_DIR, file), 'utf8'));
  }

  let totalAdded = 0;

  for (const setId of missingSets) {
    process.stdout.write(`${setId}... `);
    
    const setData = curlGet(`https://api.tcgdex.net/v2/ja/sets/${setId}`);
    if (!setData || !setData.cards) {
      console.log('no data');
      continue;
    }

    const shardFile = getShardFile(setId);
    if (shards[shardFile].sets[setId]) {
      console.log(`exists`);
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
      shards[shardFile].sets[setId] = cards;
      console.log(`✅ ${cards.length}`);
      totalAdded += cards.length;
    }
  }

  // Save
  for (const [file, data] of Object.entries(shards)) {
    fs.writeFileSync(path.join(SHARDS_DIR, file), JSON.stringify(data, null, 2));
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

  console.log(`\n✅ Added ${totalAdded} cards`);
}

main();
