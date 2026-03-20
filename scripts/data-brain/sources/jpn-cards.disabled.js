/**
 * jpn-cards.com Source Adapter
 * Currently DOWN (March 2026)
 * Good for: JP card metadata, JP names
 */

const { fetchJson } = require('../http');

const BASE_URL = 'https://www.jpn-cards.com/v2';

async function healthCheck() {
  try {
    const data = await fetchJson(`${BASE_URL}/set/`);
    return data && data.status !== 'error';
  } catch {
    return false;
  }
}

async function getCard(cardId, options = {}) {
  const data = await fetchJson(`${BASE_URL}/card/id=${cardId}`);
  const card = data.data?.[0];
  
  if (!card) return null;
  
  return {
    id: card.id,
    name: card.name,
    set: card.setData?.name,
    setCode: card.setData?.set_code,
    rarity: card.rarity,
    image: card.imageUrl,
    types: card.types,
    hp: card.hp,
    artist: card.artist
  };
}

async function getSet(setId) {
  return fetchJson(`${BASE_URL}/set/${setId}`);
}

async function getSets() {
  return fetchJson(`${BASE_URL}/set/`);
}

// jpn-cards doesn't have prices
async function getPrice() {
  return null;
}

module.exports = {
  healthCheck,
  getCard,
  getSet,
  getSets,
  getPrice
};
