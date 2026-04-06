/**
 * Normalize One Piece card from multi-language schema to flat display fields.
 * Handles both old (flat) and new (per-language) schemas transparently.
 */
function normalizeOPCard(c) {
  const lang = (v) => typeof v === 'object' && v !== null && !Array.isArray(v) && ('en' in v || 'jp' in v) ? (v.en || v.jp || null) : v;
  const langJp = (v) => typeof v === 'object' && v !== null && !Array.isArray(v) && 'jp' in v ? v.jp : null;
  if (typeof c.name !== 'object' || c.name === null || !('jp' in c.name || 'en' in c.name)) return c; // already flat
  const p = c.pricing || {};
  const computed = p.computed || {};
  return {
    ...c,
    name: lang(c.name),
    nameJp: c.name?.en && c.name?.jp ? c.name.jp : null,
    color: lang(c.color),
    trait: lang(c.trait),
    effect: lang(c.effect),
    trigger: lang(c.trigger),
    attribute: lang(c.attribute),
    sourceInfo: lang(c.sourceInfo),
    img: typeof c.img === 'object' ? (c.img?.jp || c.img?.en) : c.img,
    imgJp: typeof c.img === 'object' ? c.img?.jp : (c.imgJp || c.img),
    imgEn: typeof c.img === 'object' ? c.img?.en : c.imgEn,
    pricing: p.computed ? { jpy: computed.jpy, usd: computed.usd, source: p.method, updated: p.updated } : p,
  };
}
