#!/usr/bin/env node
/**
 * Yuyu-tei Bulk Price Fetcher — replaces rarity-estimate prices with real retail data.
 * Yuyu-tei lists individual cards with exact prices and variant separation.
 *
 * Usage:
 *   node scripts/fetch-yuyutei.js              # all rarity-estimate regular cards
 *   node scripts/fetch-yuyutei.js --limit 10   # test with 10 cards
 *   node scripts/fetch-yuyutei.js --resume     # resume from last save
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const CACHE_PATH = path.join(__dirname, '../data/onepiece-cache.json');
const PROGRESS_PATH = path.join(__dirname, '../data/yuyutei-progress.json');
const DELAY_MS = 3500;
const SAVE_EVERY = 20;

async function fetchYuyuteiPrice(page, cardId) {
  const url = `https://yuyu-tei.jp/sell/opc/s/search?search_word=${encodeURIComponent(cardId)}`;
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));

    const result = await page.evaluate((cid) => {
      const text = document.body.innerText;
      // Split into card blocks — each starts with the card ID
      const blocks = text.split(new RegExp(`(${cid.replace('-', '[-\\s]?')})`));
      
      let regularPrice = null;
      let parallelPrices = [];
      
      // Find price patterns: "NUMBER 円" after card ID
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      let currentIsParallel = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes(cid) || line.includes(cid.replace('-', ''))) {
          // Check if this block is parallel
          const context = lines.slice(i, i + 3).join(' ');
          currentIsParallel = context.includes('パラレル');
          
          // Look for price in next few lines
          for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
            const priceMatch = lines[j].match(/^([0-9,]+)\s*円/);
            if (priceMatch) {
              const price = parseInt(priceMatch[1].replace(/,/g, ''));
              if (price > 0) {
                if (currentIsParallel) {
                  parallelPrices.push(price);
                } else {
                  regularPrice = price;
                }
              }
              break;
            }
          }
        }
      }
      
      return { regular: regularPrice, parallels: parallelPrices };
    }, cardId);

    return result;
  } catch (e) {
    return null;
  }
}

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8')); }
  catch { return { done: [] }; }
}

function saveProgress(done) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify({ done, updated: new Date().toISOString() }));
}

async function main() {
  const args = process.argv.slice(2);
  const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : Infinity;
  const resume = args.includes('--resume');

  const data = JSON.parse(fs.readFileSync(CACHE_PATH));
  const progress = resume ? loadProgress() : { done: [] };
  const doneSet = new Set(progress.done);

  // Find unique card IDs with rarity-estimate regular finish
  const seen = new Set();
  const targets = [];
  for (const [setId, cards] of Object.entries(data.sets)) {
    if (!Array.isArray(cards)) continue;
    for (const card of cards) {
      if (card.pricing?.method === 'rarity-estimate' && card.finish === 'regular' && !doneSet.has(card.id) && !seen.has(card.id)) {
        seen.add(card.id);
        targets.push({ id: card.id, rarity: card.rarity || '?', setId });
      }
    }
  }

  const batch = targets.slice(0, limit);
  console.log(`🎯 ${targets.length} unique card IDs to price, processing ${batch.length}${resume ? ' (resuming)' : ''}`);
  if (!batch.length) { console.log('Nothing to do!'); return; }

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  let updated = 0, skipped = 0;
  const allDone = [...progress.done];

  for (let i = 0; i < batch.length; i++) {
    const { id, rarity } = batch[i];
    const result = await fetchYuyuteiPrice(page, id);

    if (result?.regular && result.regular > 0) {
      // Update ALL variants of this card in the cache
      for (const [setId, cards] of Object.entries(data.sets)) {
        if (!Array.isArray(cards)) continue;
        for (const card of cards) {
          if (card.id === id && card.finish === 'regular') {
            card.pricing = card.pricing || {};
            card.pricing.computed = card.pricing.computed || {};
            card.pricing.computed.jpy = result.regular;
            card.pricing.method = 'yuyutei-retail';
            card.pricing.updated = new Date().toISOString().split('T')[0];
          }
        }
      }
      updated++;
      const parStr = result.parallels.length ? ` | parallels: ${result.parallels.map(p => '¥' + p.toLocaleString()).join(', ')}` : '';
      console.log(`  ✅ ${id} (${rarity}): ¥${result.regular.toLocaleString()}${parStr}`);
    } else {
      skipped++;
      console.log(`  ⏭️  ${id} (${rarity}): not found`);
    }

    allDone.push(id);

    if ((i + 1) % SAVE_EVERY === 0 || i === batch.length - 1) {
      fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 0));
      saveProgress(allDone);
      const pct = ((i + 1) / batch.length * 100).toFixed(0);
      console.log(`\n--- ${i + 1}/${batch.length} (${pct}%) · ${updated} updated · ${skipped} not found ---\n`);
    }

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  await browser.close();
  fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 0));
  saveProgress(allDone);
  console.log(`\n✅ Done! ${updated} updated, ${skipped} not found out of ${batch.length}`);
}

main().catch(console.error);
