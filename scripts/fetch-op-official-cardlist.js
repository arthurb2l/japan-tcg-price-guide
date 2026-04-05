#!/usr/bin/env node
/**
 * Fetch One Piece card list from official site (onepiece-cardgame.com)
 * 
 * Usage: node scripts/fetch-op-official-cardlist.js <series_id> [--dry-run]
 * 
 * Series IDs (from the official site's <select> dropdown):
 *   550202 = EB-02 (Anime 25th Collection)
 *   550201 = EB-01 (Memorial Collection)
 *   550203 = EB-03 (Heroines Edition)
 *   550204 = EB-04 (Egghead Crisis)
 *   Find more by inspecting the dropdown at onepiece-cardgame.com/cardlist/
 * 
 * How it works:
 *   1. POSTs to onepiece-cardgame.com/cardlist/ with series filter
 *   2. Parses <dl class="modalCol" id="CARD_ID"> blocks
 *   3. Card IDs use _p1, _p2 etc. suffixes for parallel/variant art
 *   4. Outputs JSON card list to stdout (or updates cache with --update)
 * 
 * Variant pattern:
 *   EB02-061      = base (regular)
 *   EB02-061_p1   = parallel-1 (first alternate art)
 *   EB02-061_p2   = parallel-2 (second alternate art)
 *   OP05-001_p2   = leader reprint parallel (SP in EB sets)
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const seriesId = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
const update = process.argv.includes('--update');

if (!seriesId) {
  console.error('Usage: node fetch-op-official-cardlist.js <series_id> [--dry-run] [--update]');
  process.exit(1);
}

function post(url, data) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(data).toString();
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let html = '';
      res.on('data', chunk => html += chunk);
      res.on('end', () => resolve(html));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.error(`Fetching series ${seriesId} from official site...`);
  const html = await post('https://www.onepiece-cardgame.com/cardlist/', { series: seriesId });

  // Parse card blocks
  const blockRe = /<dl class="modalCol" id="([^"]+)"[^>]*>([\s\S]*?)<\/dl>/g;
  const cards = [];
  let match;

  while ((match = blockRe.exec(html)) !== null) {
    const [, fullId, block] = match;
    const get = (pat) => { const m = block.match(pat); return m ? m[1].trim() : null; };

    const baseId = fullId.split('_p')[0];
    const pNum = fullId.includes('_p') ? parseInt(fullId.split('_p')[1]) : 0;
    const finish = pNum === 0 ? 'regular' : `parallel-${pNum}`;

    cards.push({
      officialId: fullId,
      id: baseId,
      name: get(/<div class="cardName">([^<]+)/) || '',
      rarity: get(/<div class="infoCol">[\s\S]*?<span>[^<]+<\/span>\s*\|\s*<span>([^<]+)/) || '',
      type: get(/<div class="infoCol">[\s\S]*?<span>[^<]+<\/span>\s*\|\s*<span>[^<]+<\/span>\s*\|\s*<span>([^<]+)/) || '',
      cost: parseInt(get(/<div class="cost"><h3>[^<]+<\/h3>(\d+)/)) || null,
      power: parseInt(get(/<div class="power"><h3>[^<]+<\/h3>(\d+)/)) || null,
      counter: get(/<div class="counter"><h3>[^<]+<\/h3>([^<]+)/),
      color: get(/<div class="color"><h3>[^<]+<\/h3>([^<]+)/) || '',
      trait: get(/<div class="feature"><h3>[^<]+<\/h3>([^<]+)/) || '',
      finish,
      img: `https://www.onepiece-cardgame.com/images/cardlist/card/${fullId}.png`,
    });
  }

  const base = cards.filter(c => c.finish === 'regular').length;
  const variants = cards.filter(c => c.finish !== 'regular').length;
  console.error(`Found ${cards.length} cards (${base} base + ${variants} variants)`);

  if (dryRun) {
    console.log(JSON.stringify(cards, null, 2));
    return;
  }

  if (update) {
    // TODO: merge into onepiece-cache.json
    console.error('--update not yet implemented. Use --dry-run to inspect output.');
  } else {
    console.log(JSON.stringify(cards, null, 2));
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
