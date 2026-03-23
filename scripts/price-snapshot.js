const fs = require('fs');
const path = require('path');

const today = new Date().toISOString().split('T')[0];
const historyDir = path.join(__dirname, '../data/price-history');

if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });

// Load One Piece data
const opData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/onepiece-cache.json')));
const opPrices = {};
for (const [setId, cards] of Object.entries(opData.sets)) {
  for (const card of cards) {
    if (card.pricing?.usd >= 1) { // Only track cards worth $1+
      opPrices[card.id] = { usd: card.pricing.usd, name: card.name };
    }
  }
}

// Load Pokemon data
const pkPrices = {};
const shards = ['sv', 'swsh', 'sm', 'xy', 'bw', 'dp', 'ex', 'vintage'];
for (const shard of shards) {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, `../data/shards/${shard}.json`)));
  for (const [setId, cards] of Object.entries(data.sets)) {
    for (const card of cards) {
      const price = card.pricing?.eur || card.pricing?.usd;
      if (price >= 1) { // Only track cards worth €1+
        pkPrices[card.id] = { eur: price, name: card.name };
      }
    }
  }
}

// Save snapshot
const snapshot = {
  date: today,
  onepiece: opPrices,
  pokemon: pkPrices,
  meta: {
    opCount: Object.keys(opPrices).length,
    pkCount: Object.keys(pkPrices).length
  }
};

fs.writeFileSync(
  path.join(historyDir, `${today}.json`),
  JSON.stringify(snapshot)
);

console.log(`Snapshot saved: ${snapshot.meta.opCount} OP cards, ${snapshot.meta.pkCount} PK cards`);

// Update index
const files = fs.readdirSync(historyDir)
  .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.json$/))
  .sort();
fs.writeFileSync(path.join(historyDir, 'index.json'), JSON.stringify(files));
console.log(`Index updated: ${files.length} snapshots`);
