#!/usr/bin/env node
/**
 * Expand brain-cache.json with full sets from TCGdex
 * Usage: node expand-cache.js [setId1] [setId2] ...
 * Default: Popular Japan tourist sets
 */

const fs = require('fs');
const path = require('path');
const { fetchJson } = require('./data-brain/http');

const CACHE_FILE = path.join(__dirname, '../data/brain-cache.json');
const BASE_URL = 'https://api.tcgdex.net/v2/en';

// Popular sets for Japan tourists
const DEFAULT_SETS = ['sv03.5', 'sv04.5', 'sv08.5', 'sv01', 'sv02', 'sv03', 'sv04', 'sv05', 'sv06', 'sv07', 'sv08'];

async function fetchSet(setId, detailed = false) {
  console.log(`Fetching ${setId}${detailed ? ' (detailed)' : ''}...`);
  const set = await fetchJson(`${BASE_URL}/sets/${setId}`);
  
  if (!set.cards?.length) {
    console.log(`  No cards found for ${setId}`);
    return [];
  }
  
  let cards;
  if (detailed) {
    // Fetch full details for each card (slower but includes pricing)
    cards = [];
    for (const c of set.cards) {
      try {
        const full = await fetchJson(`${BASE_URL}/cards/${c.id}`);
        cards.push({
          id: full.id, name: full.name, localId: full.localId, image: full.image,
          set: set.name, setId, rarity: full.rarity, illustrator: full.illustrator,
          hp: full.hp, types: full.types, stage: full.stage,
          variants: full.variants,
          price: full.pricing?.cardmarket ? {
            eur: full.pricing.cardmarket.avg,
            low: full.pricing.cardmarket.low,
            trend: full.pricing.cardmarket.trend
          } : null
        });
        process.stdout.write('.');
      } catch (e) { process.stdout.write('x'); }
    }
    console.log();
  } else {
    // Basic data from set endpoint (faster)
    cards = set.cards.map(card => ({
      id: card.id, name: card.name, localId: card.localId, image: card.image,
      set: set.name, setId
    }));
  }
  
  console.log(`  Got ${cards.length} cards from ${set.name}`);
  return cards;
}

async function main() {
  const args = process.argv.slice(2);
  const detailed = args.includes('--detailed');
  const sets = args.filter(a => !a.startsWith('--')).length ? args.filter(a => !a.startsWith('--')) : DEFAULT_SETS;
  
  // Load existing cache
  let cache = { updated: new Date().toISOString(), sets: {} };
  if (fs.existsSync(CACHE_FILE)) {
    cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  }
  
  // Fetch each set
  for (const setId of sets) {
    try {
      const cards = await fetchSet(setId, detailed);
      if (cards.length) {
        cache.sets[setId] = cards;
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  cache.updated = new Date().toISOString();
  
  // Save
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  
  // Summary
  const total = Object.values(cache.sets).flat().length;
  console.log(`\nDone! ${total} cards in ${Object.keys(cache.sets).length} sets`);
}

main().catch(console.error);
