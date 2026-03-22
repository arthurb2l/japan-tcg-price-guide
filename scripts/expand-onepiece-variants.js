#!/usr/bin/env node
// Expand One Piece cards with variants into separate entries
// OP01-001 with 3 variants becomes OP01-001, OP01-001-aa, OP01-001-p2
// Safe to run multiple times - deduplicates by ID

const fs = require('fs');
const path = require('path');

const CACHE = path.join(__dirname, '../data/onepiece-cache.json');

const data = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
let expanded = 0;

for (const setId of Object.keys(data.sets)) {
  const cards = data.sets[setId];
  const seen = new Set();
  const newCards = [];
  
  for (const card of cards) {
    // Skip if already processed (dedupe)
    if (seen.has(card.id)) continue;
    seen.add(card.id);
    
    // Always add base card
    newCards.push(card);
    
    // Add variant cards if they exist and haven't been expanded yet
    if (card.variants?.length > 1 && card.images?.length > 1) {
      for (let i = 1; i < card.variants.length; i++) {
        const v = card.variants[i];
        const img = card.images[i] || card.images[0];
        const suffix = v.label === 'aa' ? '-aa' : `-p${i}`;
        const variantId = card.id + suffix;
        
        // Skip if variant already exists
        if (seen.has(variantId)) continue;
        seen.add(variantId);
        
        newCards.push({
          ...card,
          id: variantId,
          variant: v.label === 'aa' ? 'Alternate Art' : `Parallel ${i}`,
          img: img,
          imgHigh: null,
          images: [img],
          pricing: {
            usd: v.usd,
            eur: v.eur,
            source: 'limitlesstcg',
            updated: card.pricing?.updated
          },
          variants: undefined
        });
        expanded++;
      }
    }
  }
  
  data.sets[setId] = newCards;
}

fs.writeFileSync(CACHE, JSON.stringify(data, null, 2));
console.log(`Expanded ${expanded} variants into separate cards`);
console.log(`Total cards now: ${Object.values(data.sets).flat().length}`);
