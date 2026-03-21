#!/usr/bin/env node
// Shard database by era to keep files under 3MB each
const fs = require('fs');
const path = require('path');

const CACHE = path.join(__dirname, '../data/brain-cache.json');
const SHARD_DIR = path.join(__dirname, '../data/shards');

// Era definitions
const ERAS = {
  'vintage': ['base1','base2','base3','base4','base5','base6','gym1','gym2','neo1','neo2','neo3','neo4'],
  'ex': ['ex1','ex2','ex3','ex4','ex5','ex6','ex7','ex8','ex9','ex10','ex11','ex12','ex13','ex14','ex15','ex16'],
  'dp': ['dp1','dp2','dp3','dp4','dp5','dp6','dp7'],
  'bw': ['bw1','bw2','bw3','bw4','bw5','bw6','bw7','bw8','bw9','bw10','bw11'],
  'xy': ['xy0','xy1','xy2','xy3','xy4','xy5','xy6','xy7','xy8','xy9','xy10','xy11','xy12','xyp'],
  'sm': ['sm1','sm2','sm3','sm4','sm5','sm6','sm7','sm8','sm9','sm10','sm11','sm12','sm12.5','smp'],
  'swsh': ['swsh1','swsh2','swsh3','swsh3.5','swsh4','swsh4.5','swsh5','swsh6','swsh7','swsh8','swsh9','swsh10','swsh10.5','swsh11','swsh12','swsh12.5','swshp'],
  'sv': ['sv01','sv02','sv03','sv03.5','sv04','sv04.5','sv05','sv06','sv06.5','sv07','sv08','sv08.5','sv09','sv10','sv10.5b','sv10.5w','svp']
};

function getEra(setId) {
  for (const [era, sets] of Object.entries(ERAS)) {
    if (sets.includes(setId)) return era;
  }
  // Fallback by prefix
  if (setId.startsWith('sv')) return 'sv';
  if (setId.startsWith('swsh')) return 'swsh';
  if (setId.startsWith('sm')) return 'sm';
  if (setId.startsWith('xy')) return 'xy';
  if (setId.startsWith('bw')) return 'bw';
  if (setId.startsWith('dp')) return 'dp';
  if (setId.startsWith('ex')) return 'ex';
  return 'vintage';
}

function shard() {
  const data = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  
  // Group sets by era
  const shards = {};
  for (const [setId, cards] of Object.entries(data.sets)) {
    const era = getEra(setId);
    if (!shards[era]) shards[era] = { sets: {} };
    shards[era].sets[setId] = cards;
  }
  
  // Create shard directory
  if (!fs.existsSync(SHARD_DIR)) fs.mkdirSync(SHARD_DIR, { recursive: true });
  
  // Write shards
  const manifest = { lastUpdated: new Date().toISOString(), shards: {} };
  for (const [era, shard] of Object.entries(shards)) {
    const cardCount = Object.values(shard.sets).flat().length;
    const setCount = Object.keys(shard.sets).length;
    
    shard.meta = { era, lastUpdated: new Date().toISOString(), totalCards: cardCount };
    const file = `${era}.json`;
    fs.writeFileSync(path.join(SHARD_DIR, file), JSON.stringify(shard));
    
    const size = fs.statSync(path.join(SHARD_DIR, file)).size;
    manifest.shards[era] = { file, cards: cardCount, sets: setCount, size };
    console.log(`${era}: ${cardCount} cards, ${setCount} sets, ${(size/1024).toFixed(1)}KB`);
  }
  
  // Write manifest
  fs.writeFileSync(path.join(SHARD_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\nManifest written to data/shards/manifest.json');
}

shard();
