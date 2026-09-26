#!/usr/bin/env node
/**
 * Pokemon price refresh from TCGdex (free, no key) — #77.
 * Refreshes EVERY card (the old version only filled cards that had no price, so nothing
 * was updated after April 2026). Writes pricing.cardmarket / pricing.tcgplayer as TCGdex
 * returns them, the flat eur / eurLow / eurTrend fields the snapshot reads, and
 * pricing.updated. Cards TCGdex doesn't know keep their old price.
 *
 * Usage: node scripts/fetch-pokemon-prices.js [shard|all] [--limit N] [--concurrency 6] [--stale]
 */
const fs = require('fs');
const path = require('path');
const SHARDS_DIR = path.join(__dirname, '..', 'data', 'shards');
const args = process.argv.slice(2);
const target = args.find(a => !a.startsWith('--')) || 'all';
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? parseInt(args[i + 1]) : def; };
const LIMIT = opt('--limit', Infinity), CONC = opt('--concurrency', 6);
const ONLY_STALE = args.includes('--stale');   // only cards not refreshed today

async function fetchPricing(id) {
  // English catalogue first; Japanese-only sets (SV4K, SV5a…) are only in the ja catalogue
  let miss = null;
  for (const lang of ['en', 'ja']) {
    let got;
    for (let attempt = 0; attempt < 3 && got === undefined; attempt++) {
      try {
        const res = await fetch(`https://api.tcgdex.net/v2/${lang}/cards/${encodeURIComponent(id)}`);
        if (res.status === 404) got = null;
        else if (res.ok) got = (await res.json()).pricing || null;
      } catch (e) { /* retry */ }
      if (got === undefined) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
    if (got && (got.cardmarket || got.tcgplayer)) return got;
    if (got === undefined) miss = undefined;
  }
  return miss;   // null = TCGdex has no price; undefined = network trouble (card left untouched)
}

async function main() {
  const files = fs.readdirSync(SHARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'manifest.json')
    .filter(f => target === 'all' || f === `${target}.json`);
  const stats = { refreshed: 0, unchanged: 0, notFound: 0, failed: 0 };
  let seen = 0;
  for (const file of files) {
    const fp = path.join(SHARDS_DIR, file);
    const shard = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const today = new Date().toISOString().slice(0, 10);
    const cards = Object.values(shard.sets || shard).filter(Array.isArray).flat()
      .filter(c => !ONLY_STALE || c.pricing?.updated !== today).slice(0, Math.max(0, LIMIT - seen));
    seen += cards.length;
    let next = 0;
    const worker = async () => {
      while (next < cards.length) {
        const card = cards[next++];
        const pr = await fetchPricing(card.id);
        if (pr === undefined) { stats.failed++; continue; }
        if (!pr || (!pr.cardmarket && !pr.tcgplayer)) { stats.notFound++; continue; }
        const before = JSON.stringify([card.pricing?.cardmarket?.trend, card.pricing?.tcgplayer]);
        const p = card.pricing = { ...(card.pricing || {}) };
        if (pr.cardmarket) {
          p.cardmarket = pr.cardmarket;
          const cm = pr.cardmarket;
          p.eur = cm.avg ?? cm['avg-holo'] ?? p.eur;
          p.eurLow = cm.low ?? cm['low-holo'] ?? p.eurLow;
          p.eurTrend = cm.trend || cm['trend-holo'] || p.eurTrend;
        }
        if (pr.tcgplayer) p.tcgplayer = pr.tcgplayer;
        p.updated = (pr.cardmarket?.updated || pr.tcgplayer?.updated || new Date().toISOString()).slice(0, 10);
        JSON.stringify([p.cardmarket?.trend, p.tcgplayer]) === before ? stats.unchanged++ : stats.refreshed++;
      }
    };
    await Promise.all(Array.from({ length: CONC }, worker));
    fs.writeFileSync(fp, JSON.stringify(shard));
    console.log(`${file}: ${cards.length} cards — ${JSON.stringify(stats)}`);
    if (seen >= LIMIT) break;
  }
  if (stats.refreshed + stats.unchanged === 0 && stats.failed > 0) process.exit(1);   // API down: fail loudly
}
main().catch(e => { console.error(e); process.exit(1); });
