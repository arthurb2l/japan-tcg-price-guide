#!/usr/bin/env node
// Expand One Piece cards with variants into separate entries
// OP01-001 with 3 variants becomes OP01-001, OP01-001-aa, OP01-001-p2

const fs = require('fs');
const path = require('path');

const CACHE = path.join(__dirname, '../data/onepiece-cache.json');

const data = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
let expanded = 0;

for (const setId of Object.keys(data.sets)) {
  const cards = data.sets[setId];
  const newCards = [];
  
  for (const card of cards) {
    // Always add base card
    newCards.push(card);
    
    // Add variant cards if they exist
    if (card.variants?.length > 1 && card.images?.length > 1) {
      for (let i = 1; i < card.variants.length; i++) {
        const v = card.variants[i];
        const img = card.images[i] || card.images[0];
        const suffix = v.label === 'aa' ? '-aa' : `-p${i}`;
        
        newCards.push({
          ...card,
          id: card.id + suffix,
          variant: v.label === 'aa' ? 'Alternate Art' : `Parallel ${i}`,
          img: img,
          imgHigh: null, // Will need to fetch
          images: [img],
          pricing: {
            usd: v.usd,
            eur: v.eur,
            source: 'limitlesstcg',
            updated: card.pricing?.updated
          },
          variants: undefined // Remove variants from expanded cards
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
