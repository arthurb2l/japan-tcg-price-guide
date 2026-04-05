#!/usr/bin/env node
/**
 * Inventory Health Audit
 * Computes readiness scores from live data. Never stores results — always fresh.
 * 
 * Usage: node scripts/audit-inventory.js [--json] [--set OP-01]
 */
const fs = require('fs');
const path = require('path');
const glob = require('path');

const args = process.argv.slice(2);
const jsonOut = args.includes('--json');
const filterSet = args.find(a => !a.startsWith('--'));

function hasImage(c) {
  return !!(c.img || c.images?.length || c.image || c.imageUrl || c.imgJp || c.imgEn);
}

function auditCards(cards, setId, game) {
  const t = cards.length;
  if (!t) return null;
  const noName = cards.filter(c => !c.name).length;
  const noImg = cards.filter(c => !hasImage(c)).length;
  const noRarity = cards.filter(c => !c.rarity).length;
  const noPrice = cards.filter(c => {
    const p = c.pricing || {};
    return !p.jpy && !p.usd && !p.tcgplayer && !p.cardmarket;
  }).length;
  const ids = cards.map(c => c.id).filter(Boolean);
  const uniqueIds = [...new Set(ids)];
  const finishes = [...new Set(cards.map(c => c.finish || 'regular'))];
  const hasVariants = finishes.length > 1 || cards.some(c => c.finish === 'alternate-art');
  const variantCount = cards.filter(c => c.finish && c.finish !== 'regular').length;
  const setPrefix = setId.replace(/^.*\//, '').replace(/-$/, '');
  
  // Check sequential completeness per prefix
  const prefixes = [...new Set(uniqueIds.map(id => id.split('-')[0]))];
  let missingNums = [];
  for (const pfx of prefixes) {
    const nums = uniqueIds.filter(id => id.startsWith(pfx + '-')).map(id => parseInt(id.split('-')[1])).filter(n => !isNaN(n));
    if (!nums.length) continue;
    const maxN = Math.max(...nums);
    const minN = Math.min(...nums);
    // Only flag gaps within the range we have (not from 1 to max for reprints)
    const isReprint = pfx !== setPrefix;
    if (!isReprint) {
      for (let n = 1; n <= maxN; n++) {
        if (!nums.includes(n)) missingNums.push(`${pfx}-${String(n).padStart(3,'0')}`);
      }
    }
  }
  
  const verified = cards.filter(c => c._audit?.verified).length;
  const humanVerified = cards.filter(c => c._audit?.verifiedBy === 'human').length;

  const score = Math.max(0, Math.round(
    100 - (noName/t*20) - (noImg/t*30) - (noRarity/t*20) - (noPrice/t*15) - (missingNums.length*2)
  ));

  return {
    setId, game, total: t, uniqueCards: uniqueIds.length, score,
    images: t - noImg, rarity: t - noRarity, prices: t - noPrice,
    verified, humanVerified, finishes, variantCount,
    missingNums: missingNums.length ? missingNums.map(n => `${setPrefix}-${String(n).padStart(3,'0')}`) : [],
    issues: [
      noName && `${noName} no name`, noImg && `${noImg} no image`,
      noRarity && `${noRarity} no rarity`, noPrice && `${noPrice} no price`,
      missingNums.length && `${missingNums.length} gaps in numbering`,
      !hasVariants && game === 'onepiece' && t < 80 && 'no variants (may be incomplete)',
    ].filter(Boolean)
  };
}

// One Piece
const op = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'onepiece-cache.json'), 'utf8'));
const results = [];

for (const [setId, cards] of Object.entries(op.sets)) {
  if (filterSet && setId !== filterSet) continue;
  const r = auditCards(cards, setId, 'onepiece');
  if (r) results.push(r);
}

// Pokemon
const shardsDir = path.join(__dirname, '..', 'data', 'shards');
for (const file of fs.readdirSync(shardsDir).filter(f => f.endsWith('.json') && f !== 'manifest.json').sort()) {
  const shard = JSON.parse(fs.readFileSync(path.join(shardsDir, file), 'utf8'));
  const sets = shard.sets || shard;
  const era = file.replace('.json', '');
  for (const [setId, cards] of Object.entries(sets)) {
    if (!Array.isArray(cards) || !cards.length) continue;
    if (filterSet && setId !== filterSet) continue;
    const r = auditCards(cards, `${era}/${setId}`, 'pokemon');
    if (r) results.push(r);
  }
}

if (jsonOut) {
  console.log(JSON.stringify(results, null, 2));
} else {
  const games = { onepiece: results.filter(r => r.game === 'onepiece'), pokemon: results.filter(r => r.game === 'pokemon') };
  for (const [game, sets] of Object.entries(games)) {
    const t = sets.reduce((s, r) => s + r.total, 0);
    const v = sets.reduce((s, r) => s + r.verified, 0);
    const hv = sets.reduce((s, r) => s + r.humanVerified, 0);
    const clean = sets.filter(r => r.score >= 95).length;
    console.log(`\n### ${game.toUpperCase()} — ${t} cards, ${sets.length} sets (${clean} clean)`);
    console.log(`    Verified: ${v}/${t} (${(v/t*100).toFixed(0)}%) | Human: ${hv}/${t}`);
    for (const r of sets) {
      const icon = r.score >= 95 ? '✅' : r.score >= 70 ? '⚠️' : '❌';
      const issues = r.issues.length ? r.issues.join(', ') : 'clean';
      const hv = r.humanVerified ? ` [${r.humanVerified} human✓]` : '';
      const vars = r.variantCount ? ` (${r.variantCount} variants)` : '';
      console.log(`  ${icon} ${r.setId.padEnd(18)} ${String(r.total).padStart(4)} cards  ${String(r.score).padStart(3)}%  ${issues}${hv}${vars}`);
      if (r.missingNums.length && r.missingNums.length <= 5) console.log(`     ↳ missing: ${r.missingNums.join(', ')}`);
    }
  }
}
