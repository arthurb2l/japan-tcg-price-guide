#!/usr/bin/env node
// Enhanced One Piece data from limitlesstcg.com
// Gets: prices for all variants, better images, complete text

const fs = require('fs');
const path = require('path');

const CACHE = path.join(__dirname, '../data/onepiece-cache.json');
const DELAY = 600;

async function fetchCardData(cardId) {
  const url = `https://onepiece.limitlesstcg.com/cards/${cardId}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const html = await res.text();
    
    // Extract high-res image from limitlesstcg CDN
    const imgMatch = html.match(/src="(https:\/\/limitlesstcg\.nyc3\.cdn[^"]+)"/);
    const imgHigh = imgMatch?.[1] || null;
    
    // Extract all price rows - pattern: card-number span, then USD, then EUR
    const variants = [];
    const rowRegex = /prints-table-card-number">([^<]*)<\/span>[\s\S]*?card-price usd[^>]*>\$?([\d.]+)<[\s\S]*?card-price eur[^>]*>([\d.,]+)€?</g;
    
    let match, idx = 0;
    while ((match = rowRegex.exec(html)) !== null) {
      const [, variantCode, usd, eur] = match;
      variants.push({
        id: idx,
        label: variantCode?.trim() || 'Regular',
        usd: parseFloat(usd),
        eur: parseFloat(eur.replace(',', '.'))
      });
      idx++;
    }
    
    return { imgHigh, variants };
  } catch (e) { 
    console.error(`Error ${cardId}: ${e.message}`);
    return null; 
  }
}

async function run() {
  const setId = process.argv[2] || 'OP01';
  const data = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  const cards = data.sets[setId];
  
  if (!cards) {
    console.log(`Set ${setId} not found. Available: ${Object.keys(data.sets).join(', ')}`);
    return;
  }
  
  console.log(`Enhancing ${setId}: ${cards.length} cards\n`);
  
  let processed = 0, enhanced = 0;
  
  for (const card of cards) {
    const result = await fetchCardData(card.id);
    if (result) {
      if (result.imgHigh) card.imgHigh = result.imgHigh;
      if (result.variants.length > 0) {
        const base = result.variants[0]; // First row is always base/regular
        card.pricing = {
          usd: base.usd,
          eur: base.eur,
          source: 'limitlesstcg',
          updated: new Date().toISOString().split('T')[0]
        };
        // Store variant prices if multiple exist
        if (result.variants.length > 1) {
          card.variants = result.variants;
        }
        enhanced++;
      }
    }
    processed++;
    process.stdout.write(`\r${processed}/${cards.length} (${enhanced} enhanced)`);
    await new Promise(r => setTimeout(r, DELAY));
  }
  
  console.log(`\n\nEnhanced ${enhanced}/${cards.length} cards`);
  fs.writeFileSync(CACHE, JSON.stringify(data, null, 2));
  console.log('Saved to onepiece-cache.json');
}

run().catch(console.error);
