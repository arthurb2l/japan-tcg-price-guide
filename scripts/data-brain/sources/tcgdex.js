/**
 * TCGdex Source Adapter
 * Free, unlimited, open source
 * Good for: metadata, images, some JP names
 */

const { fetchJson } = require('../http');

const BASE_URL = 'https://api.tcgdex.net/v2';

async function healthCheck() {
  try {
    const data = await fetchJson(`${BASE_URL}/en/sets`);
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

async function getCard(cardId, options = {}) {
  const lang = options.language || 'en';
  const data = await fetchJson(`${BASE_URL}/${lang}/cards/${cardId}`);
  
  return {
    id: data.id,
    name: data.name,
    localId: data.localId,
    image: data.image,
    rarity: data.rarity,
    set: data.set?.name,
    setId: data.set?.id,
    types: data.types,
    hp: data.hp,
    artist: data.illustrator,
    pricing: data.pricing || null
  };
}

async function getSet(setId, options = {}) {
  const lang = options.language || 'en';
  const data = await fetchJson(`${BASE_URL}/${lang}/sets/${setId}`);
  
  return {
    id: data.id,
    name: data.name,
    cardCount: data.cardCount?.total,
    cards: data.cards || []
  };
}

async function getSets(options = {}) {
  const lang = options.language || 'en';
  return fetchJson(`${BASE_URL}/${lang}/sets`);
}

// TCGdex doesn't have prices
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
