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
    return !p.jpy && !p.tcgplayer && !p.cardmarket;
  }).length;
  const ids = cards.map(c => c.id).filter(Boolean);
  const dupes = ids.length - new Set(ids).size;
  const verified = cards.filter(c => c._audit?.verified).length;
  const humanVerified = cards.filter(c => c._audit?.verifiedBy === 'human').length;

  const score = Math.max(0, Math.round(
    100 - (noName/t*20) - (noImg/t*30) - (noRarity/t*20) - (noPrice/t*15) - (dupes/t*15)
  ));

  return {
    setId, game, total: t, score,
    images: t - noImg, rarity: t - noRarity, prices: t - noPrice,
    verified, humanVerified, dupes,
    issues: [
      noName && `${noName} no name`, noImg && `${noImg} no image`,
      noRarity && `${noRarity} no rarity`, noPrice && `${noPrice} no price`,
      dupes && `${dupes} dupe IDs`
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
      console.log(`  ${icon} ${r.setId.padEnd(18)} ${String(r.total).padStart(4)} cards  ${String(r.score).padStart(3)}%  ${issues}${hv}`);
    }
  }
}
