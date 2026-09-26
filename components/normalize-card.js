/**
 * Normalize One Piece card from multi-language schema to flat display fields.
 * Handles both old (flat) and new (per-language) schemas transparently.
 */
const _BANDAI_JP = 'https://www.onepiece-cardgame.com/images/cardlist/card/';
const _BANDAI_EN = 'https://en.onepiece-cardgame.com/images/cardlist/card/';

function _resolveOPImg(c, lang) {
  // Extract existing URL
  const raw = typeof c.img === 'object' ? c.img?.[lang] : (lang === 'en' ? c.imgEn : (c.imgJp || c.img));
  if (raw) return raw;
  // The other language has a real image → this card isn't printed in `lang`;
  // a guessed URL would 404 (565 broken images before #139), so return nothing.
  const other = typeof c.img === 'object' ? c.img?.[lang === 'en' ? 'jp' : 'en'] : (lang === 'en' ? (c.imgJp || c.img) : c.imgEn);
  if (other) return null;
  // No URL at all — construct from card ID + finish if parallel/reprint
  const finish = c.finish || '';
  const id = c.id || '';
  if (!id) return null;
  const m = finish.match(/^(parallel)-?(\d+)$/);
  if (m) {
    const suffix = `_p${m[2]}`;
    const base = lang === 'en' ? _BANDAI_EN : _BANDAI_JP;
    return `${base}${id}${suffix}.png`;
  }
  const r = finish.match(/^(reprint)-?(\d+)$/);
  if (r) {
    const base = lang === 'en' ? _BANDAI_EN : _BANDAI_JP;
    return `${base}${id}_r${r[2]}.png`;
  }
  return null;
}

function normalizeOPCard(c) {
  try {
    const lang = (v) => typeof v === 'object' && v !== null && !Array.isArray(v) && ('en' in v || 'jp' in v) ? (v.en || v.jp || null) : v;
    const langJp = (v) => typeof v === 'object' && v !== null && !Array.isArray(v) && 'jp' in v ? v.jp : null;
    if (typeof c.name !== 'object' || c.name === null || !('jp' in c.name || 'en' in c.name)) {
      // Old flat schema — just ensure setId exists
      return { ...c, setId: c.setId || c.set };
    }
  const p = c.pricing || {};
  const computed = p.computed || {};
  return {
    ...c,
    name: lang(c.name),
    nameJp: c.name?.en && c.name?.jp ? c.name.jp : null,
    setId: c.setId || c.set,
    color: lang(c.color),
    trait: lang(c.trait),
    effect: lang(c.effect),
    trigger: lang(c.trigger),
    attribute: lang(c.attribute),
    sourceInfo: lang(c.sourceInfo),
    img: _resolveOPImg(c, 'jp') || _resolveOPImg(c, 'en'),
    imgJp: _resolveOPImg(c, 'jp'),
    imgEn: _resolveOPImg(c, 'en'),
    pricing: p.sources ? p : (p.computed ? { jpy: computed.jpy, usd: computed.usd, source: p.method, updated: p.updated } : p),
  };
  } catch(e) { return { ...c, setId: c.setId || c.set }; }
}

/**
 * Deduplicate OP cards: merge entries with same id + finish.
 * Keeps richest data from each duplicate (JP img from one, EN img from other, etc.)
 */
function deduplicateOPCards(cards) {
  const map = new Map();
  for (const c of cards) {
    const key = `${c.id || ''}|${c.finish || ''}`;
    const existing = map.get(key);
    if (!existing) { map.set(key, c); continue; }
    // Merge: fill nulls from the new entry
    if (!existing.officialId && c.officialId) existing.officialId = c.officialId; // keeps cardKey() stable
    if (!existing.imgJp && c.imgJp) existing.imgJp = c.imgJp;
    if (!existing.imgEn && c.imgEn) existing.imgEn = c.imgEn;
    if (!existing.img && c.img) existing.img = c.img;
    if (!existing.nameJp && c.nameJp) existing.nameJp = c.nameJp;
    if (!existing.name && c.name) existing.name = c.name;
    // Prefer entry with pricing
    const ep = existing.pricing || {};
    const cp = c.pricing || {};
    if ((!ep.jpy && !ep.sources) && (cp.jpy || cp.sources)) existing.pricing = cp;
    // The same version can sit in several sets (e.g. OP05-119_p6 under OP-09 EN, OP-10, OP-11):
    // an exact per-version price beats a shared bucket price from another copy
    else if (cp.versionMatch === 'exact' && ep.versionMatch !== 'exact') existing.pricing = cp;
  }
  return [...map.values()];
}

/**
 * Inventory key for a card (#194). One Piece versions share `id` (OP17-001 and
 * its parallel OP17-001_p1), so they are keyed by Bandai's officialId. Regular
 * cards keep their old key (officialId === id), so existing saves stay valid.
 */
function cardKey(c) {
  if (c.officialId) return c.officialId;
  return !c.finish || c.finish === 'regular' ? c.id : `${c.id}|${c.finish}`;
}

/**
 * Rename legacy inventory keys to their officialId (data/onepiece-id-migrations.json).
 * Mutates `coll`; returns [[oldKey, newKey], ...] so callers can persist the move.
 */
async function migrateInventoryKeys(coll) {
  let map = {};
  try {
    const base = location.pathname.includes('/japan-tcg-price-guide/') ? '/japan-tcg-price-guide' : '';
    map = (await fetch(`${base}/data/onepiece-id-migrations.json`).then(r => r.json())).map || {};
  } catch (e) { return []; }
  const moved = [];
  for (const [oldKey, newKey] of Object.entries(map)) {
    if (!coll[oldKey]) continue;
    const prev = coll[newKey];
    coll[newKey] = prev ? { ...coll[oldKey], ...prev, qty: (prev.qty || 1) + (coll[oldKey].qty || 1) } : coll[oldKey];
    delete coll[oldKey];
    moved.push([oldKey, newKey]);
  }
  return moved;
}

/** Persist migrateInventoryKeys() moves to Firestore (users/{uid}/inventory). */
async function persistInventoryMoves(db, uid, coll, moved) {
  if (!moved.length) return;
  const batch = db.batch();
  const inv = db.collection('users').doc(uid).collection('inventory');
  for (const [oldKey, newKey] of moved) { batch.delete(inv.doc(oldKey)); batch.set(inv.doc(newKey), coll[newKey]); }
  await batch.commit();
}

/**
 * Load every card (Pokemon shards + One Piece cache) with game + key set.
 * Shared by pages that only need a flat card list (stats, goals, trade, favorites,
 * new-releases) — they used to fetch data/pokemon.json + data/onepiece.json, which don't exist.
 */
async function loadAllCards() {
  const base = location.pathname.includes('/japan-tcg-price-guide/') ? '/japan-tcg-price-guide' : '';
  const j = u => fetch(`${base}/data/${u}`).then(r => r.json());
  let pokemon = [];
  try {
    const manifest = await j('shards/manifest.json');
    const shards = await Promise.all(Object.values(manifest.shards).map(s => j(`shards/${s.file}`)));
    pokemon = shards.flatMap(s => Object.values(s.sets).flat());
  } catch (e) {
    pokemon = Object.values((await j('brain-cache.json')).sets).flat();
  }
  const op = deduplicateOPCards(Object.values((await j('onepiece-cache.json')).sets).flat().map(normalizeOPCard));
  const all = [...pokemon.map(c => ({ ...c, game: 'pokemon' })), ...op.map(c => ({ ...c, game: 'onepiece' }))];
  all.forEach(c => { c.key = cardKey(c); c.setId = c.setId || c.set; });
  return all;
}

/** Human label for a card's version ('' for the regular card): "Parallel 2", "Super parallel", "Reprint"… */
function versionLabel(c) {
  const f = String((c && c.finish) || 'regular');
  if (f === 'regular') return '';
  let m;
  if ((m = f.match(/^parallel-?(\d+)?$/))) return 'Parallel' + (m[1] ? ' ' + m[1] : '');
  if (f === 'super-parallel') return 'Super parallel';
  if (f.startsWith('reprint')) return 'Reprint';
  if (f === 'alternate-art') return 'Alt art';
  return f.replace(/-/g, ' ');
}
