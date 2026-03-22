#!/usr/bin/env node
// Import One Piece cards from nemesis312/OnePieceTCGEngCardList GitHub repo
// Source: https://github.com/nemesis312/OnePieceTCGEngCardList

const fs = require('fs');
const path = require('path');

const SOURCE_URL = 'https://raw.githubusercontent.com/nemesis312/OnePieceTCGEngCardList/main/CardDb3.json';
const CACHE_FILE = path.join(__dirname, '../data/onepiece-cache.json');

// Parse set ID from CardSets string like "Card Set(s)-ROMANCE DAWN- [OP01]"
function parseSetId(cardSets) {
  if (!cardSets) return 'PROMO';
  const match = cardSets.match(/\[([A-Z0-9-]+)\]/i);
  return match ? match[1].toUpperCase() : 'PROMO';
}

// Parse set name from CardSets string
function parseSetName(cardSets) {
  if (!cardSets) return 'Promo';
  const match = cardSets.match(/Card Set\(s\)-?(.+?)-?\s*\[/);
  if (match) {
    return match[1].trim().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  }
  // Handle special cases like "Card Set(s)Big Mom Pirates [ST-07]"
  const match2 = cardSets.match(/Card Set\(s\)(.+?)\s*\[/);
  return match2 ? match2[1].trim() : 'Promo';
}

// Normalize card ID (remove # prefix)
function normalizeId(cardNum) {
  return cardNum.replace(/^#/, '');
}

async function importCards() {
  console.log('Fetching One Piece cards from GitHub...');
  
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
  
  const data = await response.json();
  const cards = data.Cards;
  
  console.log(`Found ${cards.length} cards`);
  
  // Group by set
  const sets = {};
  const setNames = {};
  
  for (const card of cards) {
    const setId = parseSetId(card.CardSets);
    const setName = parseSetName(card.CardSets);
    
    if (!sets[setId]) {
      sets[setId] = [];
      setNames[setId] = setName;
    }
    
    // Transform to our format (setId for compatibility with search.html)
    const transformed = {
      id: normalizeId(card.CardNum),
      name: card.Name,
      set: setName,
      setId: setId,
      rarity: card.Rarity,
      type: card.CardType,
      color: card.Color,
      cost: card.Cost !== '-' ? parseInt(card.Cost) || null : null,
      power: card.Power !== '-' ? parseInt(card.Power) || null : null,
      counter: card.Counter !== '-' ? parseInt(card.Counter) || null : null,
      attribute: card.Attribute !== '-' ? card.Attribute : null,
      block: card.Block !== '-' ? parseInt(card.Block) || null : null,
      trait: card.Type !== '-' ? card.Type : null,
      effect: card.Effect,
      img: card.Img,
      images: card.Images || [card.Img],
      source: 'nemesis312/OnePieceTCGEngCardList'
    };
    
    sets[setId].push(transformed);
  }
  
  // Sort sets by ID
  const sortedSetIds = Object.keys(sets).sort((a, b) => {
    // OP sets first, then ST, then others
    const aNum = a.match(/\d+/)?.[0] || '999';
    const bNum = b.match(/\d+/)?.[0] || '999';
    if (a.startsWith('OP') && !b.startsWith('OP')) return -1;
    if (!a.startsWith('OP') && b.startsWith('OP')) return 1;
    if (a.startsWith('ST') && !b.startsWith('ST')) return -1;
    if (!a.startsWith('ST') && b.startsWith('ST')) return 1;
    return parseInt(aNum) - parseInt(bNum);
  });
  
  // Build final structure
  const finalSets = {};
  for (const setId of sortedSetIds) {
    finalSets[setId] = sets[setId];
  }
  
  const output = {
    meta: {
      lastUpdated: new Date().toISOString(),
      source: 'https://github.com/nemesis312/OnePieceTCGEngCardList',
      totalCards: cards.length,
      totalSets: Object.keys(finalSets).length
    },
    sets: finalSets
  };
  
  // Write to cache
  fs.writeFileSync(CACHE_FILE, JSON.stringify(output, null, 2));
  
  console.log(`\nImported ${cards.length} cards across ${Object.keys(finalSets).length} sets`);
  console.log('\nSets:');
  for (const setId of sortedSetIds) {
    console.log(`  ${setId}: ${sets[setId].length} cards (${setNames[setId]})`);
  }
  
  console.log(`\nSaved to ${CACHE_FILE}`);
}

importCards().catch(console.error);
