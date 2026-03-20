/**
 * Data Brain - Multi-source card data aggregation
 * Intelligent routing with self-improving accuracy scores
 */

const fs = require('fs');
const path = require('path');

// Source adapters
const tcgdex = require('./sources/tcgdex');
const pokemonPriceTracker = require('./sources/pokemon-price-tracker');
const jpnCards = require('./sources/jpn-cards');

const METRICS_FILE = path.join(__dirname, '../../data/source-metrics.json');

// Default metrics
const defaultMetrics = {
  sources: {
    tcgdex: { accuracyScore: 0.7, requestsToday: 0, health: 'unknown' },
    pokemonPriceTracker: { accuracyScore: 0.85, requestsToday: 0, health: 'unknown' },
    jpnCards: { accuracyScore: 0.9, requestsToday: 0, health: 'down' }
  },
  lastReset: new Date().toISOString().split('T')[0]
};

// Source registry
const sources = {
  tcgdex: {
    id: 'tcgdex',
    adapter: tcgdex,
    provides: ['metadata', 'images', 'jp_names'],
    quota: Infinity,
    requiresKey: false
  },
  pokemonPriceTracker: {
    id: 'pokemonPriceTracker',
    adapter: pokemonPriceTracker,
    provides: ['metadata', 'prices', 'price_history', 'jp_cards'],
    quota: 100,
    requiresKey: true
  },
  jpnCards: {
    id: 'jpnCards',
    adapter: jpnCards,
    provides: ['metadata', 'jp_names', 'images'],
    quota: Infinity,
    requiresKey: false
  }
};

let metrics = null;

function loadMetrics() {
  try {
    if (fs.existsSync(METRICS_FILE)) {
      metrics = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
      // Reset daily counters if new day
      const today = new Date().toISOString().split('T')[0];
      if (metrics.lastReset !== today) {
        for (const s of Object.values(metrics.sources)) {
          s.requestsToday = 0;
        }
        metrics.lastReset = today;
      }
    } else {
      metrics = defaultMetrics;
    }
  } catch {
    metrics = defaultMetrics;
  }
  return metrics;
}

function saveMetrics() {
  const dir = path.dirname(METRICS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(METRICS_FILE, JSON.stringify(metrics, null, 2));
}

/**
 * Select best source for a data type
 * Priority: free unlimited > free limited > paid (reserve for prices)
 */
function selectSource(dataType, options = {}) {
  if (!metrics) loadMetrics();
  
  const candidates = Object.entries(sources)
    .filter(([id, s]) => s.provides.includes(dataType))
    .filter(([id]) => metrics.sources[id]?.health !== 'down')
    .map(([id, s]) => {
      const m = metrics.sources[id];
      const quotaRemaining = s.quota === Infinity ? Infinity : s.quota - (m.requestsToday || 0);
      return { id, source: s, quotaRemaining, accuracy: m.accuracyScore || 0 };
    })
    .filter(c => c.quotaRemaining > 0);
  
  // Sort: unlimited first, then by accuracy
  candidates.sort((a, b) => {
    // Unlimited sources first (unless explicitly requesting paid)
    if (!options.preferPaid) {
      if (a.quotaRemaining === Infinity && b.quotaRemaining !== Infinity) return -1;
      if (b.quotaRemaining === Infinity && a.quotaRemaining !== Infinity) return 1;
    }
    // Then by accuracy
    return b.accuracy - a.accuracy;
  });
  
  return candidates[0]?.source || null;
}

/**
 * Get quota status for all sources
 */
function getQuotaStatus() {
  if (!metrics) loadMetrics();
  
  return Object.entries(sources).map(([id, s]) => {
    const m = metrics.sources[id];
    const used = m.requestsToday || 0;
    const remaining = s.quota === Infinity ? Infinity : s.quota - used;
    return {
      id,
      quota: s.quota,
      used,
      remaining,
      percentUsed: s.quota === Infinity ? 0 : Math.round(used / s.quota * 100)
    };
  });
}

/**
 * Fetch card data with intelligent routing
 */
async function getCard(cardId, options = {}) {
  if (!metrics) loadMetrics();
  
  const result = { id: cardId, _meta: { sources: [], fetchedAt: new Date().toISOString() } };
  
  // Get metadata from free source first
  const metaSource = selectSource('metadata');
  if (metaSource) {
    try {
      const data = await metaSource.adapter.getCard(cardId, options);
      Object.assign(result, data);
      result._meta.sources.push(metaSource.id);
      metrics.sources[metaSource.id].requestsToday++;
    } catch (e) {
      console.error(`[${metaSource.id}] metadata fetch failed:`, e.message);
    }
  }
  
  // Get prices only if explicitly requested (conserve paid quota)
  if (options.includePrices) {
    const priceSource = selectSource('prices', { preferPaid: true });
    if (priceSource && priceSource.adapter.getPrice) {
      try {
        const priceData = await priceSource.adapter.getPrice(cardId, options);
        result.prices = priceData;
        if (!result._meta.sources.includes(priceSource.id)) {
          result._meta.sources.push(priceSource.id);
        }
        metrics.sources[priceSource.id].requestsToday++;
      } catch (e) {
        console.error(`[${priceSource.id}] price fetch failed:`, e.message);
      }
    }
  }
  
  saveMetrics();
  return result;
}

/**
 * Health check all sources
 */
async function healthCheck() {
  if (!metrics) loadMetrics();
  
  for (const [id, source] of Object.entries(sources)) {
    try {
      const healthy = await source.adapter.healthCheck();
      metrics.sources[id].health = healthy ? 'up' : 'down';
      metrics.sources[id].lastCheck = new Date().toISOString();
    } catch {
      metrics.sources[id].health = 'down';
    }
  }
  
  saveMetrics();
  return metrics.sources;
}

/**
 * Update accuracy score (called after validation)
 */
function updateAccuracy(sourceId, wasAccurate) {
  if (!metrics) loadMetrics();
  
  const source = metrics.sources[sourceId];
  if (!source) return;
  
  const weight = 0.1;
  if (wasAccurate) {
    source.accuracyScore = Math.min(1, source.accuracyScore + weight * (1 - source.accuracyScore));
  } else {
    source.accuracyScore = Math.max(0, source.accuracyScore - weight * source.accuracyScore);
  }
  
  saveMetrics();
}

/**
 * Get current metrics
 */
function getMetrics() {
  if (!metrics) loadMetrics();
  return metrics;
}

module.exports = {
  getCard,
  healthCheck,
  updateAccuracy,
  getMetrics,
  getQuotaStatus,
  selectSource
};
