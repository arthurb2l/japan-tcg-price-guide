#!/usr/bin/env node
/**
 * Mercari JP Bulk Price Fetcher — replaces rarity-estimate prices with real sold data.
 *
 * Usage:
 *   node scripts/fetch-mercari-bulk.js              # all rarity-estimate cards
 *   node scripts/fetch-mercari-bulk.js --limit 10   # test with 10 cards
 *   node scripts/fetch-mercari-bulk.js --resume      # resume from last save
 *
 * Saves progress every 20 cards. Safe to interrupt (Ctrl+C) and resume.
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const CACHE_PATH = path.join(__dirname, '../data/onepiece-cache.json');
const PROGRESS_PATH = path.join(__dirname, '../data/mercari-progress.json');
const DELAY_MS = 4000;
const SAVE_EVERY = 20;

async function fetchMercariPrice(page, cardId) {
  const query = encodeURIComponent(cardId + ' ワンピース カード');
  const url = `https://jp.mercari.com/search?keyword=${query}&status=sold_out&sort=created_time&order=desc`;

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
    await new Promise(r => setTimeout(r, 2500));

    const prices = await page.evaluate(() => {
      const matches = document.body.innerText.match(/¥([0-9,]+)/g);
      if (!matches) return [];
      return matches.slice(0, 8).map(y => parseInt(y.replace(/[¥,]/g, '')));
    });

    // Filter out noise (shipping costs, UI elements)
    const valid = prices.filter(p => p >= 30 && p < 500000);
    if (valid.length < 2) return null;

    valid.sort((a, b) => a - b);
    const median = valid[Math.floor(valid.length / 2)];
    return { jpy: median, usd: Math.round(median / 150 * 100) / 100, samples: valid.length };
  } catch (e) {
    return null;
  }
}

function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
  } catch { return { done: [] }; }
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

  // Find all cards with rarity-estimate pricing
  const targets = [];
  for (const [setId, cards] of Object.entries(data.sets)) {
    if (!Array.isArray(cards)) continue;
    for (const card of cards) {
      const method = card.pricing?.method || '';
      if (method === 'rarity-estimate' && card.finish === 'regular' && !doneSet.has(card.id)) {
        targets.push({ id: card.id, finish: card.finish || 'regular', rarity: card.rarity || '?', setId, card });
      }
    }
  }

  // Prioritize: SR/SEC/SP first (higher value, more likely to have sold data), then R, then C/UC
  const rarityOrder = { SEC: 0, SP: 1, SR: 2, R: 3, L: 4, P: 5, UC: 6, C: 7 };
  targets.sort((a, b) => (rarityOrder[a.rarity] ?? 8) - (rarityOrder[b.rarity] ?? 8));

  const batch = targets.slice(0, limit);
  console.log(`🎯 ${targets.length} rarity-estimate cards total, processing ${batch.length}${resume ? ' (resuming)' : ''}`);
  if (batch.length === 0) { console.log('Nothing to do!'); return; }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  let updated = 0, skipped = 0, failed = 0;
  const allDone = [...progress.done];

  for (let i = 0; i < batch.length; i++) {
    const { id, rarity, finish, card } = batch[i];
    const result = await fetchMercariPrice(page, id);

    if (result && result.jpy > 0) {
      // Update the pricing structure that deal-hunter and search.html read
      card.pricing = card.pricing || {};
      card.pricing.computed = card.pricing.computed || {};
      card.pricing.computed.jpy = result.jpy;
      card.pricing.computed.usd = result.usd;
      card.pricing.method = 'mercari-sold';
      card.pricing.updated = new Date().toISOString().split('T')[0];
      card.pricing.samples = result.samples;
      updated++;
      console.log(`  ✅ ${id} (${rarity}/${finish}): ¥${result.jpy.toLocaleString()} [${result.samples} samples]`);
    } else {
      skipped++;
      console.log(`  ⏭️  ${id} (${rarity}/${finish}): no sold data`);
    }

    allDone.push(id);

    // Save progress periodically
    if ((i + 1) % SAVE_EVERY === 0 || i === batch.length - 1) {
      fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 0));
      saveProgress(allDone);
      const pct = ((i + 1) / batch.length * 100).toFixed(0);
      console.log(`\n--- ${i + 1}/${batch.length} (${pct}%) · ${updated} updated · ${skipped} no data ---\n`);
    }

    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  await browser.close();
  fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 0));
  saveProgress(allDone);

  console.log(`\n✅ Done! ${updated} updated, ${skipped} no data, ${failed} errors out of ${batch.length}`);
  console.log(`   Total rarity-estimate remaining: ${targets.length - batch.length}`);
}

main().catch(console.error);
