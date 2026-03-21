#!/usr/bin/env node
/**
 * Enrich brain-cache.json with full metadata from TCGdex
 * Fetches rarity, hp, types, price for cards missing them
 */

const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '../data/brain-cache.json');
const BASE_URL = 'https://api.tcgdex.net/v2/en';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function enrichSet(setId, cards) {
  console.log(`Enriching ${setId} (${cards.length} cards)...`);
  let enriched = 0, errors = 0;
  
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    // Skip if already has metadata
    if (card.rarity && card.hp !== undefined) continue;
    
    try {
      const full = await fetchJson(`${BASE_URL}/cards/${card.id}`);
      card.rarity = full.rarity || null;
      card.hp = full.hp || null;
      card.types = full.types || null;
      card.stage = full.stage || null;
      card.illustrator = full.illustrator || null;
      if (full.variants) card.variants = full.variants;
      
      // Price from cardmarket
      if (full.pricing?.cardmarket) {
        card.price = {
          eur: full.pricing.cardmarket.avg,
          low: full.pricing.cardmarket.low,
          trend: full.pricing.cardmarket.trend
        };
      }
      enriched++;
      process.stdout.write('.');
    } catch (e) {
      errors++;
      process.stdout.write('x');
    }
    
    // Rate limit
    if (i % 50 === 49) await new Promise(r => setTimeout(r, 500));
  }
  
  console.log(` +${enriched} enriched, ${errors} errors`);
  return enriched;
}

async function main() {
  const args = process.argv.slice(2);
  const limit = args.find(a => a.startsWith('--limit='))?.split('=')[1] || 5;
  
  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  
  // Find sets missing metadata
  const needsEnrich = Object.entries(cache.sets)
    .filter(([_, cards]) => cards[0] && !cards[0].rarity)
    .sort((a, b) => {
      // Prioritize SV and SWSH sets (most relevant for Japan tourists)
      const priority = id => id.startsWith('sv') ? 0 : id.startsWith('swsh') ? 1 : 2;
      return priority(a[0]) - priority(b[0]) || a[0].localeCompare(b[0]);
    })
    .slice(0, parseInt(limit));
  
  console.log(`Found ${needsEnrich.length} sets to enrich (limit: ${limit})`);
  
  let totalEnriched = 0;
  for (const [setId, cards] of needsEnrich) {
    totalEnriched += await enrichSet(setId, cards);
  }
  
  cache.updated = new Date().toISOString();
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  console.log(`\nDone! Enriched ${totalEnriched} cards. Cache updated.`);
}

main().catch(console.error);
