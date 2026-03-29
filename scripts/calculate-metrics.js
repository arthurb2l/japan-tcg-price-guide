const fs = require('fs');
const path = require('path');
const dataDir = path.join(__dirname, '..', 'data');

const loadJSON = (file) => { try { return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8')); } catch { return null; } };

// One Piece
const op = loadJSON('onepiece-cache.json');
let opCards = 0, opSets = 0;
if (op?.sets) { for (const cards of Object.values(op.sets)) opCards += cards.length; opSets = Object.keys(op.sets).length; }

// Pokemon (shards)
let pkCards = 0, pkSets = 0;
const shardsDir = path.join(dataDir, 'shards');
try {
  for (const f of fs.readdirSync(shardsDir).filter(f => f.endsWith('.json') && f !== 'manifest.json')) {
    const shard = JSON.parse(fs.readFileSync(path.join(shardsDir, f), 'utf8'));
    const sets = shard.sets || shard;
    for (const [id, cards] of Object.entries(sets)) {
      if (Array.isArray(cards)) { pkCards += cards.length; pkSets++; }
    }
  }
} catch {}

console.log(JSON.stringify({
  generated: new Date().toISOString(),
  pokemon: { totalCards: pkCards, setsCount: pkSets },
  onepiece: { totalCards: opCards, setsCount: opSets },
  totals: { cards: opCards + pkCards, sets: opSets + pkSets }
}, null, 2));
