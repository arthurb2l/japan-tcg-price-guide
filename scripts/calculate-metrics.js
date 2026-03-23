const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

// Load cache files
const loadCache = (file) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
  } catch { return null; }
};

const pokemon = loadCache('pokemon-cache.json');
const onepiece = loadCache('onepiece-cache.json');

const countCards = (data) => {
  if (!data?.sets) return { total: 0, sets: 0 };
  let total = 0;
  for (const cards of Object.values(data.sets)) total += cards.length;
  return { total, sets: Object.keys(data.sets).length };
};

const pokemonStats = countCards(pokemon);
const onepieceStats = countCards(onepiece);

const metrics = {
  generated: new Date().toISOString(),
  pokemon: {
    totalCards: pokemonStats.total,
    setsCount: pokemonStats.sets,
    lastSync: pokemon?.lastSync || null
  },
  onepiece: {
    totalCards: onepieceStats.total,
    setsCount: onepieceStats.sets,
    lastSync: onepiece?.lastSync || null
  },
  totals: {
    cards: pokemonStats.total + onepieceStats.total,
    sets: pokemonStats.sets + onepieceStats.sets
  }
};

console.log(JSON.stringify(metrics, null, 2));
