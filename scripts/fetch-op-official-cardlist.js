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
  fr: { host: 'fr.onepiece-cardgame.com', prefix: '622' },
  tc: { host: 'asia-tc.onepiece-cardgame.com', prefix: '554' },
  th: { host: 'asia-th.onepiece-cardgame.com', prefix: '563' },
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

  // Normalize set IDs: "OP07" → "OP-07", "EB01" → "EB-01", etc.
  const normalizeSetId = (id) => id.replace(/^(OP|EB|ST|PRB)(\d)/, '$1-$2');

  // Group new cards by normalized set
  const bySet = {};
  for (const card of newCards) {
    const setId = normalizeSetId(card.set);
    card.set = setId;
    if (!bySet[setId]) bySet[setId] = [];
    bySet[setId].push(card);
  }

  let added = 0, updated = 0, preserved = 0;

  for (const [setId, cards] of Object.entries(bySet)) {
    if (!cache.sets[setId]) cache.sets[setId] = [];
    const existing = cache.sets[setId];

    for (const card of cards) {
      // Match by officialId first, then by id+finish
      const idx = existing.findIndex(c =>
        c.officialId === card.officialId ||
        (c.id === card.id && c.finish === card.finish) ||
        (c.id === card.id && !c.officialId && c.finish === card.finish)
      );

      if (idx >= 0) {
        existing[idx] = migrateCard(existing[idx], card, lang);
        updated++;
      } else {
        existing.push(toNewSchema(card, lang));
        added++;
      }
    }
    preserved += existing.filter(c => !cards.find(nc =>
      nc.officialId === c.officialId || (nc.id === c.id && nc.finish === c.finish)
    )).length;
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
  // --- Migrate old flat pricing to new schema ---
  let pricing;
  const op = old.pricing || {};

  if (op.sources) {
    // Already new schema — just preserve
    pricing = op;
  } else {
    // Old flat schema: { jpy, usd, source, updated, original_en }
    const srcName = op.source && op.source !== 'pending' ? op.source.split('-')[0] : null;
    pricing = {
      sources: {},
      computed: {
        jpy: op.jpy || null,
        usd: op.usd || null,
        eur: null, krw: null, cny: null, thb: null,
      },
      method: op.source || null,
      primarySource: srcName,
      updated: op.updated || null,
    };
    if (srcName && (op.usd || op.jpy)) {
      pricing.sources[srcName] = {};
      if (op.original_en) pricing.sources[srcName].usd = op.original_en;
      if (op.usd) pricing.sources[srcName].usd = pricing.sources[srcName].usd || op.usd;
      if (op.jpy) pricing.sources[srcName].jpy = op.jpy;
      pricing.sources[srcName].updated = op.updated || null;
    }
  }

  // --- Helper: merge a field into per-language object ---
  const isLangObj = (v) => v && typeof v === 'object' && !Array.isArray(v) && ('jp' in v || 'en' in v);
  const EMPTY_LANG = { jp: null, en: null, fr: null, cn: null, kr: null, th: null };

  const mergeLang = (oldVal, newVal, fieldName) => {
    if (isLangObj(oldVal)) {
      // Already migrated — just set the new language
      return { ...oldVal, [cardLang]: newVal };
    }
    // Old flat value — figure out which language it was
    const obj = { ...EMPTY_LANG };
    obj[cardLang] = newVal;
    if (oldVal != null) {
      // Old data: if source was EN repo, old value is EN; if official-jp, old value is JP
      const oldSource = old.source || old._audit?.source || '';
      if (oldSource.includes('nemesis312') || oldSource === 'ai-generated') {
        obj.en = obj.en || oldVal;
      } else {
        obj.jp = obj.jp || oldVal;
      }
    }
    return obj;
  };

  // --- Merge image field ---
  const mergeImg = () => {
    if (isLangObj(old.img)) {
      return { ...old.img, [cardLang]: fresh.img };
    }
    const obj = { ...EMPTY_LANG };
    obj[cardLang] = fresh.img;
    obj.jp = obj.jp || old.imgJp || null;
    obj.en = obj.en || old.imgEn || (Array.isArray(old.images) && old.images[0]) || null;
    return obj;
  };

  return {
    id: fresh.id,
    officialId: fresh.officialId,
    set: fresh.set,
    rarity: fresh.rarity || old.rarity,
    type: fresh.type || old.type,
    name: mergeLang(old.name, fresh.name, 'name'),
    life: fresh.type === 'LEADER' ? (fresh.life ?? old.life ?? null) : null,
    cost: fresh.type !== 'LEADER' ? (fresh.cost ?? old.cost ?? null) : null,
    attribute: mergeLang(old.attribute, fresh.attribute, 'attribute'),
    power: fresh.power ?? old.power ?? null,
    counter: fresh.counter ?? old.counter ?? null,
    color: mergeLang(old.color, fresh.color, 'color'),
    blockIcon: fresh.blockIcon ?? old.blockIcon ?? old.block ?? null,
    trait: mergeLang(old.trait, fresh.trait, 'trait'),
    effect: mergeLang(old.effect, fresh.effect, 'effect'),
    trigger: mergeLang(old.trigger, fresh.trigger, 'trigger'),
    sourceInfo: mergeLang(old.sourceInfo, fresh.sourceInfo, 'sourceInfo'),
    finish: fresh.finish || old.finish,
    img: mergeImg(),
    pricing,
    popularity: old.popularity || null,
    tags: old.tags || [],
    _meta: {
      source: 'official',
      fetchedAt: new Date().toISOString(),
      verified: old._audit?.verified || old._meta?.verified || false,
    },
  };
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
