/**
 * jpn-cards.com Source Adapter
 * Currently DOWN (March 2026)
 * Good for: JP card metadata, JP names
 */

const { execSync } = require('child_process');

const BASE_URL = 'https://www.jpn-cards.com/v2';

function fetchJson(url) {
  try {
    const result = execSync(`curl -sk "${url}"`, { 
      encoding: 'utf8',
      timeout: 10000 
    });
    return JSON.parse(result);
  } catch (e) {
    throw new Error(`Fetch failed: ${e.message}`);
  }
}

async function healthCheck() {
  try {
    const data = fetchJson(`${BASE_URL}/set/`);
    // Check for the specific error they return when down
    return data && data.status !== 'error';
  } catch {
    return false;
  }
}

async function getCard(cardId, options = {}) {
  const data = fetchJson(`${BASE_URL}/card/id=${cardId}`);
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
