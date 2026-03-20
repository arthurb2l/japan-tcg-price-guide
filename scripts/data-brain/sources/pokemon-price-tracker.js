/**
 * PokemonPriceTracker Source Adapter
 * Free tier: 100 credits/day
 * Good for: prices, price history, JP cards
 */

const { execSync } = require('child_process');

const BASE_URL = 'https://www.pokemonpricetracker.com/api/v2';

// API key from environment
const API_KEY = process.env.POKEMON_PRICE_TRACKER_KEY || '';

function fetchJson(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) url.searchParams.set(k, String(v));
  });
  
  let cmd = `curl -s "${url.toString()}"`;
  if (API_KEY) {
    cmd = `curl -s -H "Authorization: Bearer ${API_KEY}" "${url.toString()}"`;
  }
  
  try {
    const result = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
    return JSON.parse(result);
  } catch (e) {
    throw new Error(`Fetch failed: ${e.message}`);
  }
}

async function healthCheck() {
  try {
    const data = fetchJson('/sets', { limit: 1 });
    return data && !data.error;
  } catch {
    return false;
  }
}

async function getCard(cardId, options = {}) {
  const params = {
    search: cardId,
    limit: 1,
    language: options.language || 'english'
  };
  
  const data = await fetchJson('/cards', params);
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
  const params = {
    search: cardId,
    limit: 1,
    language: options.language === 'ja' ? 'japanese' : 'english',
    includeHistory: options.includeHistory || false
  };
  
  const data = await fetchJson('/cards', params);
  const card = data.data?.[0];
  
  if (!card?.prices) return null;
  
  return {
    market: card.prices.market,
    low: card.prices.low,
    mid: card.prices.mid,
    high: card.prices.high,
    history: card.priceHistory || null,
    currency: 'USD',
    source: 'pokemonPriceTracker'
  };
}

async function getSets(options = {}) {
  const params = {
    language: options.language === 'ja' ? 'japanese' : 'english'
  };
  return fetchJson('/sets', params);
}

module.exports = {
  healthCheck,
  getCard,
  getPrice,
  getSets
};
