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
  // No URL — construct from card ID + finish if parallel/reprint
  const finish = c.finish || '';
  const id = c.officialId || c.id || '';
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
    img: _resolveOPImg(c, 'jp'),
    imgJp: _resolveOPImg(c, 'jp'),
    imgEn: _resolveOPImg(c, 'en'),
    pricing: p.sources ? p : (p.computed ? { jpy: computed.jpy, usd: computed.usd, source: p.method, updated: p.updated } : p),
  };
  } catch(e) { return { ...c, setId: c.setId || c.set }; }
}
