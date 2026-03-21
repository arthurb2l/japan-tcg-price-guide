#!/usr/bin/env node
// Fetch missing Pokemon sets from TCGdex using curl

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
  if (id.startsWith('sm')) return 'sm.json';
  if (id.startsWith('xy')) return 'xy.json';
  if (id.startsWith('bw')) return 'bw.json';
  if (id.startsWith('dp') || id.startsWith('pt') || id.startsWith('hgss')) return 'dp.json';
  if (id.startsWith('ex') || id.startsWith('adv') || id.startsWith('pcg') || id.startsWith('pmcg')) return 'ex.json';
  return 'vintage.json';
}

function main() {
  const missingSets = [
    'E1', 'E2', 'E3', 'E4', 'E5',
    'PCG1', 'PCG2', 'PCG3', 'PCG4', 'PCG5', 'PCG6', 'PCG7', 'PCG8', 'PCG9',
    'PMCG1', 'PMCG2', 'PMCG3', 'PMCG4', 'PMCG5', 'PMCG6',
    'S9', 'S9a', 'S12', 'S12a',
    'SV1S', 'SV1V', 'SV2D', 'SV2P', 'SV2a', 'SV3', 'SV3a',
    'SV4K', 'SV4M', 'SV4a', 'SV5K', 'SV5a', 'SV6', 'SV7', 'SV7a',
    'SV8', 'SV8a', 'SV9', 'SV9a', 'SV10', 'SV11W',
    'SVK', 'SVLN', 'SVLS',
    'VS1', 'web1'
  ];

  // Load existing shards
  const shards = {};
  for (const file of fs.readdirSync(SHARDS_DIR)) {
    if (file === 'manifest.json') continue;
    shards[file] = JSON.parse(fs.readFileSync(path.join(SHARDS_DIR, file), 'utf8'));
  }

  let totalAdded = 0;

  for (const setId of missingSets) {
    process.stdout.write(`${setId}... `);
    
    const setData = curlGet(`https://api.tcgdex.net/v2/ja/sets/${setId}`);
    if (!setData || !setData.cards || setData.cards.length === 0) {
      console.log('no cards');
      continue;
    }

    const shardFile = getShardFile(setId);
    if (!shards[shardFile]) {
      console.log('unknown shard');
      continue;
    }

    if (shards[shardFile].sets[setId]) {
      console.log(`exists (${shards[shardFile].sets[setId].length})`);
      continue;
    }

    // Fetch all cards for this set in one go using the set endpoint
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
      console.log(`✅ ${cards.length} → ${shardFile}`);
      totalAdded += cards.length;
    } else {
      console.log('failed');
    }
  }

  // Save shards
  for (const [file, data] of Object.entries(shards)) {
    fs.writeFileSync(path.join(SHARDS_DIR, file), JSON.stringify(data, null, 2));
  }

  // Update manifest
  const manifest = { lastUpdated: new Date().toISOString(), shards: {} };
  for (const [file, data] of Object.entries(shards)) {
    const cardCount = Object.values(data.sets).flat().length;
    manifest.shards[file.replace('.json', '')] = {
      file,
      cards: cardCount,
      sets: Object.keys(data.sets).length,
      size: JSON.stringify(data).length
    };
  }
  fs.writeFileSync(path.join(SHARDS_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`\n✅ Added ${totalAdded} cards total`);
}

main();
