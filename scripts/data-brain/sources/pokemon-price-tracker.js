/**
 * PokemonPriceTracker Source Adapter
 * Free tier: 100 credits/day
 * Good for: prices, price history, JP cards
 */

const { fetchJson } = require('../http');

const BASE_URL = 'https://www.pokemonpricetracker.com/api/v2';
const API_KEY = process.env.POKEMON_PRICE_TRACKER_KEY || '';

async function healthCheck() {
  try {
    const headers = API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {};
    const data = await fetchJson(`${BASE_URL}/sets?limit=1`, { headers });
    return data && !data.error;
  } catch {
    return false;
  }
}

async function getCard(cardId, options = {}) {
  const url = `${BASE_URL}/cards?search=${encodeURIComponent(cardId)}&limit=1`;
  const headers = API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {};
  
  const data = await fetchJson(url, { headers });
  const card = data.data?.[0];
  
  if (!card) return null;
  
  return {
    id: card.tcgPlayerId || cardId,
    name: card.name,
    set: card.setName,
    rarity: card.rarity,
    image: card.imageUrl
  };
}

async function getPrice(cardId, options = {}) {
  const lang = options.language === 'ja' ? 'japanese' : 'english';
  const url = `${BASE_URL}/cards?search=${encodeURIComponent(cardId)}&limit=1&language=${lang}`;
  const headers = API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {};
  
  const data = await fetchJson(url, { headers });
  const card = data.data?.[0];
  
  if (!card?.prices) return null;
  
  return {
    market: card.prices.market,
    low: card.prices.low,
    mid: card.prices.mid,
    high: card.prices.high,
    currency: 'USD',
    source: 'pokemonPriceTracker'
  };
}

async function getSets(options = {}) {
  const lang = options.language === 'ja' ? 'japanese' : 'english';
  const url = `${BASE_URL}/sets?language=${lang}`;
  const headers = API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {};
  return fetchJson(url, { headers });
}

module.exports = {
  healthCheck,
  getCard,
  getPrice,
  getSets
};
