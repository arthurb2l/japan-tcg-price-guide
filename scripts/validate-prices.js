#!/usr/bin/env node
/**
 * Price Validation — catches suspicious/bad pricing data
 * Usage: node scripts/validate-prices.js [--fix]
 */
const fs = require('fs');
const path = require('path');

const FIX = process.argv.includes('--fix');
const issues = [];

function flag(cardId, game, issue, details) {
  issues.push({ cardId, game, issue, details });
}

// ONE PIECE
const op = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'onepiece-cache.json'), 'utf8'));
for (const [setId, cards] of Object.entries(op.sets)) {
  for (const card of cards) {
    const p = card.pricing || {};
    const jpy = p.jpy || 0;
    const usd = p.usd || 0;
    
    // Sanity checks
    if (jpy > 500000) flag(card.id, 'op', 'price_extreme_high', `¥${jpy.toLocaleString()}`);
    if (jpy > 0 && jpy < 10) flag(card.id, 'op', 'price_suspiciously_low', `¥${jpy}`);
    if (usd > 0 && jpy > 0 && Math.abs(jpy / usd - 150) > 100) flag(card.id, 'op', 'usd_jpy_mismatch', `$${usd} vs ¥${jpy} (ratio: ${(jpy/usd).toFixed(0)})`);
    
    // Rarity vs price sanity
    if (card.rarity === 'C' && jpy > 500) flag(card.id, 'op', 'common_expensive', `${card.rarity} at ¥${jpy}`);
    if ((card.rarity === 'SR' || card.rarity === 'SEC') && jpy < 100 && !card.id.includes('-p')) flag(card.id, 'op', 'rare_too_cheap', `${card.rarity} at ¥${jpy}`);
    
    // Duplicate price (exact same jpy in many cards = likely bulk assignment)
    // Skip — bulk ¥50 is intentional for commons
  }
}

// POKEMON
const glob = require('path');
const shardsDir = path.join(__dirname, '..', 'data', 'shards');
for (const file of fs.readdirSync(shardsDir).filter(f => f.endsWith('.json') && f !== 'manifest.json')) {
  const shard = JSON.parse(fs.readFileSync(path.join(shardsDir, file), 'utf8'));
  const sets = shard.sets || shard;
  for (const [setId, cards] of Object.entries(sets)) {
    if (!Array.isArray(cards)) continue;
    for (const card of cards) {
      const p = card.pricing || {};
      const tcg = p.tcgplayer;
      const cm = p.cardmarket;
      
      if (tcg?.normal?.marketPrice > 1000) flag(card.id, 'pk', 'price_extreme_high', `$${tcg.normal.marketPrice}`);
      if (tcg?.normal?.marketPrice < 0) flag(card.id, 'pk', 'negative_price', `$${tcg.normal.marketPrice}`);
      
      // Cross-check: TCGPlayer vs Cardmarket should be in same ballpark
      if (tcg?.normal?.marketPrice && cm?.trend) {
        const tcgJpy = tcg.normal.marketPrice * 150;
        const cmJpy = cm.trend * 162;
        if (tcgJpy > 100 && cmJpy > 100 && (tcgJpy / cmJpy > 5 || cmJpy / tcgJpy > 5)) {
          flag(card.id, 'pk', 'source_price_divergence', `TCG $${tcg.normal.marketPrice} vs CM €${cm.trend}`);
        }
      }
    }
  }
}

// Output
console.log(`\nPrice Validation: ${issues.length} issues found\n`);
const byType = {};
for (const i of issues) {
  byType[i.issue] = (byType[i.issue] || 0) + 1;
}
for (const [type, count] of Object.entries(byType).sort((a,b) => b[1] - a[1])) {
  console.log(`  ${type}: ${count}`);
}
if (issues.length > 0) {
  console.log('\nDetails (first 30):');
  for (const i of issues.slice(0, 30)) {
    console.log(`  ${i.game} ${i.cardId}: ${i.issue} — ${i.details}`);
  }
}
