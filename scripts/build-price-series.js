#!/usr/bin/env node
/**
 * Compact price series for the card popup chart (#157).
 * Reads every daily snapshot in data/price-history/ and writes one small file per set,
 * data/price-series/<shard>.json = { dates: [...], s: { cardKey: [[dateIndex, jpy], ...] } },
 * keeping only the days a card's price changed (plus its last known day).
 * All values in JPY: One Piece jpy (JP shop floor, from 2026-09-26); Pokemon eur×162 (Cardmarket).
 * One Piece usd snapshots before 2026-04-20 are US-market prices, a different market: excluded
 * so the chart doesn't show a fake jump between markets.
 * Card keys match cardKey(): One Piece officialId (OP05-119_p7), Pokemon id (sv03-066).
 */
const fs = require('fs'), path = require('path');
const HIST = path.join(__dirname, '../data/price-history'), OUT = path.join(__dirname, '../data/price-series');
const files = fs.readdirSync(HIST).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
const dates = files.map(f => f.slice(0, 10));
const series = {};   // key -> [[i, jpy]]
const push = (key, i, jpy) => {
  if (!(jpy > 0)) return;
  jpy = Math.round(jpy);
  const s = (series[key] = series[key] || []);
  if (!s.length || s[s.length - 1][1] !== jpy) s.push([i, jpy]);
  else s[s.length - 1].last = i;   // unchanged: remember the latest day it was seen
};
files.forEach((f, i) => {
  const d = JSON.parse(fs.readFileSync(path.join(HIST, f)));
  for (const [k, v] of Object.entries(d.onepiece || {})) push(k, i, v.jpy);
  for (const [k, v] of Object.entries(d.pokemon || {})) push(k, i, (v.eur ? v.eur * 162 : 0) || (v.usd ? v.usd * 150 : 0));
});
// shard by set prefix: OP05-119_p7 -> OP05, P-080 -> P, PRB01-DON-Ace -> PRB01, sv03-066 -> sv03
const shardOf = k => (k.match(/^([A-Za-z]+\d*)/) || ['', 'misc'])[1].toLowerCase();
const shards = {};
for (const [k, s] of Object.entries(series)) {
  const pts = s.flatMap(p => p.last !== undefined ? [[p[0], p[1]], [p.last, p[1]]] : [[p[0], p[1]]]);
  if (pts.length < 2) continue;    // one point is not a history
  (shards[shardOf(k)] = shards[shardOf(k)] || {})[k] = pts;
}
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
let bytes = 0;
for (const [sh, s] of Object.entries(shards)) {
  const body = JSON.stringify({ dates, s });
  fs.writeFileSync(path.join(OUT, `${sh}.json`), body); bytes += body.length;
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(Object.keys(shards).sort()));   // lets the page skip missing shards (no 404s)
console.log(`${Object.keys(series).length} cards, ${Object.values(shards).reduce((n, s) => n + Object.keys(s).length, 0)} with ≥2 points, ${Object.keys(shards).length} shards, ${(bytes / 1e6).toFixed(1)} MB`);
