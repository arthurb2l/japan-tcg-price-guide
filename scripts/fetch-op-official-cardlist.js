#!/usr/bin/env node
/**
 * Fetch One Piece card list from official Bandai site
 * Issue #132: Scalable card fetching from official cardlist
 *
 * Usage:
 *   node scripts/fetch-op-official-cardlist.js <series_id> [--dry-run]
 *   node scripts/fetch-op-official-cardlist.js --all --lang jp [--dry-run]
 *   node scripts/fetch-op-official-cardlist.js --all --lang en [--dry-run]
 *   node scripts/fetch-op-official-cardlist.js --all --lang jp --update
 *
 * Sites:
 *   JP: onepiece-cardgame.com (550xxx series IDs)
 *   EN: en.onepiece-cardgame.com (569xxx series IDs)
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const SITES = {
  jp: { host: 'www.onepiece-cardgame.com', prefix: '55' },
  en: { host: 'en.onepiece-cardgame.com', prefix: '56' },
};

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const update = args.includes('--update');
const fetchAll = args.includes('--all');
const langFlag = args.indexOf('--lang');
const lang = langFlag >= 0 ? args[langFlag + 1] : 'jp';
const seriesId = !fetchAll ? args.find(a => /^\d+$/.test(a)) : null;

if (!fetchAll && !seriesId) {
  console.error('Usage:');
  console.error('  node fetch-op-official-cardlist.js <series_id> [--dry-run]');
  console.error('  node fetch-op-official-cardlist.js --all --lang jp|en [--dry-run|--update]');
  process.exit(1);
}

const site = SITES[lang];
if (!site) { console.error('Unknown lang: ' + lang + '. Use jp or en.'); process.exit(1); }

function request(urlPath, postData) {
  return new Promise((resolve, reject) => {
    const body = postData ? new URLSearchParams(postData).toString() : null;
    const opts = {
      hostname: site.host,
      path: urlPath,
      method: body ? 'POST' : 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (Japan-TCG-Price-Guide)', ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } : {}) },
    };
    const req = https.request(opts, res => {
      if (res.statusCode === 302) {
        // Follow redirect
        const loc = res.headers.location;
        const newPath = loc.startsWith('http') ? new URL(loc).pathname + new URL(loc).search : urlPath.replace(/[^/]*$/, '') + loc;
        return request(newPath, null).then(resolve).catch(reject);
      }
      let html = '';
      res.on('data', c => html += c);
      res.on('end', () => resolve(html));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function discoverSeries(html) {
  const series = [];
  const optRe = /value="(\d+)"/g;
  let m;
  while ((m = optRe.exec(html)) !== null) {
    const id = m[1];
    if (id.startsWith(site.prefix) && !series.includes(id)) {
      const idx = html.indexOf('value="' + id + '"');
      const ctx = html.substring(idx, idx + 300);
      const labelM = ctx.match(/>([^<]+)</);
      const label = labelM ? labelM[1].replace(/&lt;.*?&gt;/g, '').replace(/&amp;/g, '&').trim() : id;
      // Extract set code like [OP-15] or 【OP-15】
      const codeM = ctx.match(/[【\[]([\w-]+)[】\]]/);
      series.push({ id, label, code: codeM ? codeM[1] : null });
    }
  }
  return series;
}

function parseCards(html, seriesCode) {
  const blockRe = /<dl class="modalCol" id="([^"]+)"[^>]*>([\s\S]*?)<\/dl>/g;
  const cards = [];
  let match;

  while ((match = blockRe.exec(html)) !== null) {
    const [, fullId, block] = match;
    const get = (re) => { const m = block.match(re); return m ? m[1].trim() : null; };
    const getDiv = (cls) => {
      const re = new RegExp('<div class="' + cls + '">[\\s\\S]*?<h3>[^<]*(?:<br[^>]*>)?[^<]*</h3>([\\s\\S]*?)</div>');
      const m = block.match(re);
      if (!m) return null;
      return m[1].replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').trim() || null;
    };

    // Header: ID | Rarity | Type
    const infoM = block.match(/<div class="infoCol">\s*<span>([^<]+)<\/span>\s*\|\s*<span>([^<]+)<\/span>\s*\|\s*<span>([^<]+)/);
    const cardNumber = infoM ? infoM[1].trim() : fullId;
    const rarity = infoM ? infoM[2].trim() : null;
    const type = infoM ? infoM[3].trim() : null;

    // Variant detection
    const baseId = fullId.split('_')[0];
    const suffix = fullId.includes('_') ? fullId.split('_').slice(1).join('_') : null;
    let finish = 'regular';
    if (suffix) {
      if (suffix.startsWith('p')) finish = 'parallel-' + suffix.slice(1);
      else if (suffix.startsWith('r')) finish = 'reprint-' + suffix.slice(1);
      else finish = suffix;
    }

    // Name
    const name = get(/<div class="cardName">([^<]+)/);

    // Image
    const imgM = block.match(/data-src="[^"]*\/card\/([^"?]+)/);
    const imgFile = imgM ? imgM[1] : fullId + '.png';
    const img = `https://${site.host}/images/cardlist/card/${imgFile}`;

    // Fields
    const costOrLife = getDiv('cost');
    const isLeader = type === 'LEADER';

    // Attribute - can be text or image alt
    let attribute = getDiv('attribute');
    if (!attribute || attribute === '-') {
      const attrImgM = block.match(/<div class="attribute">[\s\S]*?alt="([^"]+)"/);
      if (attrImgM) attribute = attrImgM[1].trim();
    }

    const power = getDiv('power');
    const counter = getDiv('counter');
    const color = getDiv('color');

    // Block icon
    const blockIcon = getDiv('block');

    const trait = getDiv('feature');
    const effect = getDiv('text');

    // Trigger (EVENT cards only)
    const trigger = getDiv('trigger');

    // Source info
    const sourceInfo = getDiv('getInfo');

    cards.push({
      id: baseId,
      officialId: fullId,
      set: seriesCode || baseId.replace(/-?\d+$/, ''),
      rarity,
      type,
      name,
      life: isLeader ? (parseInt(costOrLife) || null) : null,
      cost: !isLeader ? (parseInt(costOrLife) || null) : null,
      attribute: attribute === '-' ? null : attribute,
      power: power === '-' ? null : (parseInt(power) || null),
      counter: counter === '-' ? null : counter,
      color,
      blockIcon: blockIcon ? (parseInt(blockIcon) || blockIcon) : null,
      trait,
      effect,
      trigger,
      sourceInfo,
      finish,
      img,
    });
  }
  return cards;
}

async function fetchSeries(sid, code) {
  const html = await request('/cardlist/', { series: sid });
  return parseCards(html, code);
}

async function main() {
  if (fetchAll) {
    // Discover all series from dropdown
    console.error(`Discovering ${lang.toUpperCase()} series from ${site.host}...`);
    const defaultSeries = site.prefix + '0101';
    const page = await request('/cardlist/', { series: defaultSeries });
    const series = discoverSeries(page);
    console.error(`Found ${series.length} series`);

    let allCards = [];
    for (const s of series) {
      console.error(`  Fetching ${s.code || s.id} (${s.label.substring(0, 50)})...`);
      const cards = await fetchSeries(s.id, s.code);
      const base = cards.filter(c => c.finish === 'regular').length;
      const variants = cards.length - base;
      console.error(`    → ${cards.length} cards (${base} base + ${variants} variants)`);
      allCards = allCards.concat(cards);
      await sleep(1500); // polite rate limiting
    }

    const baseTotal = allCards.filter(c => c.finish === 'regular').length;
    console.error(`\nTotal: ${allCards.length} cards (${baseTotal} base + ${allCards.length - baseTotal} variants) across ${series.length} series`);

    if (dryRun) {
      console.log(JSON.stringify({ lang, series: series.length, totalCards: allCards.length, cards: allCards }, null, 2));
    } else if (update) {
      updateCache(allCards, series);
    } else {
      console.log(JSON.stringify(allCards, null, 2));
    }
  } else {
    // Single series
    console.error(`Fetching series ${seriesId} from ${site.host}...`);
    const cards = await fetchSeries(seriesId, null);
    const base = cards.filter(c => c.finish === 'regular').length;
    console.error(`Found ${cards.length} cards (${base} base + ${cards.length - base} variants)`);

    if (dryRun || !update) {
      console.log(JSON.stringify(cards, null, 2));
    } else {
      updateCache(cards, null);
    }
  }
}

function updateCache(newCards, seriesList) {
  const cachePath = path.join(__dirname, '..', 'data', 'onepiece-cache.json');
  let cache = { meta: {}, sets: {} };
  if (fs.existsSync(cachePath)) {
    cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  }

  // Group new cards by set
  const bySet = {};
  for (const card of newCards) {
    const setId = card.set;
    if (!bySet[setId]) bySet[setId] = [];
    bySet[setId].push(card);
  }

  let added = 0, updated = 0, preserved = 0;

  for (const [setId, cards] of Object.entries(bySet)) {
    if (!cache.sets[setId]) cache.sets[setId] = [];
    const existing = cache.sets[setId];

    for (const card of cards) {
      const key = card.officialId;
      const idx = existing.findIndex(c => c.officialId === key || (c.id === card.id && c.finish === card.finish));

      if (idx >= 0) {
        // Merge: preserve pricing, update card data with language-specific fields
        const old = existing[idx];
        const merged = migrateCard(old, card, lang);
        existing[idx] = merged;
        updated++;
      } else {
        // New card
        existing.push(toNewSchema(card, lang));
        added++;
      }
    }
    preserved += existing.filter(c => !cards.find(nc => nc.officialId === c.officialId)).length;
  }

  // Update meta
  cache.meta = {
    lastUpdated: new Date().toISOString(),
    source: 'official-bandai',
    totalCards: Object.values(cache.sets).reduce((sum, s) => sum + s.length, 0),
    totalSets: Object.keys(cache.sets).length,
    languages: [...new Set([...(cache.meta.languages || []), lang])],
  };

  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  console.error(`Cache updated: ${added} added, ${updated} updated, ${preserved} preserved`);
}

function toNewSchema(card, cardLang) {
  const langField = (val) => {
    const obj = { jp: null, en: null, fr: null, cn: null, kr: null, th: null };
    obj[cardLang] = val;
    return obj;
  };

  return {
    id: card.id,
    officialId: card.officialId,
    set: card.set,
    rarity: card.rarity,
    type: card.type,
    name: langField(card.name),
    life: card.life,
    cost: card.cost,
    attribute: langField(card.attribute),
    power: card.power,
    counter: card.counter,
    color: langField(card.color),
    blockIcon: card.blockIcon,
    trait: langField(card.trait),
    effect: langField(card.effect),
    trigger: langField(card.trigger),
    sourceInfo: langField(card.sourceInfo),
    finish: card.finish,
    img: langField(card.img),
    pricing: {
      sources: {},
      computed: { jpy: null, usd: null, eur: null, krw: null, cny: null, thb: null },
      method: null,
      primarySource: null,
      updated: null,
    },
    popularity: null,
    tags: [],
    _meta: { source: 'official', fetchedAt: new Date().toISOString(), verified: false },
  };
}

function migrateCard(old, fresh, cardLang) {
  // Preserve existing pricing
  const pricing = old.pricing || {
    sources: {},
    computed: { jpy: old.pricing?.jpy || null, usd: old.pricing?.usd || null, eur: null, krw: null, cny: null, thb: null },
    method: old.pricing?.source || null,
    primarySource: null,
    updated: old.pricing?.updated || null,
  };

  // Migrate old flat pricing to new schema if needed
  if (pricing.jpy !== undefined && !pricing.computed) {
    pricing = {
      sources: pricing.source ? { [pricing.source.split('-')[0]]: { jpy: pricing.jpy, usd: pricing.usd, updated: pricing.updated } } : {},
      computed: { jpy: pricing.jpy || null, usd: pricing.usd || null, eur: null, krw: null, cny: null, thb: null },
      method: pricing.source || null,
      primarySource: pricing.source ? pricing.source.split('-')[0] : null,
      updated: pricing.updated || null,
    };
  }

  // Helper to merge language fields
  const mergeLang = (oldVal, newVal) => {
    if (typeof oldVal === 'object' && oldVal !== null && !Array.isArray(oldVal) && 'jp' in oldVal) {
      // Already new schema
      const merged = { ...oldVal };
      merged[cardLang] = newVal;
      return merged;
    }
    // Old flat field → migrate
    const obj = { jp: null, en: null, fr: null, cn: null, kr: null, th: null };
    if (cardLang === 'jp') { obj.jp = newVal; obj.en = oldVal; }
    else if (cardLang === 'en') { obj.en = newVal; obj.jp = oldVal; }
    else { obj[cardLang] = newVal; }
    return obj;
  };

  return {
    id: fresh.id,
    officialId: fresh.officialId,
    set: fresh.set,
    rarity: fresh.rarity || old.rarity,
    type: fresh.type || old.type,
    name: mergeLang(old.name, fresh.name),
    life: fresh.life ?? old.life ?? null,
    cost: fresh.cost ?? old.cost ?? null,
    attribute: mergeLang(old.attribute, fresh.attribute),
    power: fresh.power ?? old.power ?? null,
    counter: fresh.counter ?? old.counter ?? null,
    color: mergeLang(old.color, fresh.color),
    blockIcon: fresh.blockIcon ?? old.blockIcon ?? null,
    trait: mergeLang(old.trait, fresh.trait),
    effect: mergeLang(old.effect, fresh.effect),
    trigger: mergeLang(old.trigger, fresh.trigger),
    sourceInfo: mergeLang(old.sourceInfo, fresh.sourceInfo),
    finish: fresh.finish || old.finish,
    img: mergeLang(old.img || old.imgJp || old.imgEn, fresh.img),
    pricing,
    popularity: old.popularity || null,
    tags: old.tags || [],
    _meta: { source: 'official', fetchedAt: new Date().toISOString(), verified: old._audit?.verified || old._meta?.verified || false },
  };
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
