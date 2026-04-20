/**
 * Shared price utilities — single source of truth for all pages.
 * Include: <script src="/japan-tcg-price-guide/components/price-utils.js"></script>
 */

/** Get JP floor price in yen. Returns 0 if no price. */
function getFloorJpy(c) {
  if (!c || !c.pricing) return 0;
  const p = c.pricing;
  // v2: pricing.sources.{surugaya,yuyutei,cardrush}.jpy
  if (p.sources) {
    const jpys = Object.values(p.sources).map(s => s && s.jpy).filter(Boolean);
    if (jpys.length) return Math.min(...jpys);
  }
  // computed.jpy fallback
  if (p.computed && p.computed.jpy) return p.computed.jpy;
  // normalized flat jpy
  if (p.jpy) return p.jpy;
  // legacy USD-based (convert at 150)
  if (p.usd) return Math.round(p.usd * 150);
  if (p.tcgplayer) {
    const tp = p.tcgplayer.normal || p.tcgplayer.holofoil;
    if (tp && tp.marketPrice) return Math.round(tp.marketPrice * 150);
  }
  if (p.cardmarket && p.cardmarket.trend) return Math.round(p.cardmarket.trend * 162);
  return 0;
}

/** Get price as USD equivalent (for legacy compat with collection/trade). */
function getFloorUsd(c) {
  const jpy = getFloorJpy(c);
  return jpy ? jpy / 150 : 0;
}

/** Format price for display. currency: 'JPY'|'USD'|'EUR' */
function formatPrice(c, currency) {
  const jpy = getFloorJpy(c);
  if (!jpy) return '-';
  if (currency === 'USD') return '$' + (jpy / 150).toFixed(2);
  if (currency === 'EUR') return '€' + (jpy / 162).toFixed(2);
  return '¥' + jpy.toLocaleString();
}

/** Render full price modal HTML with sources, geo breakdown, links. */
function renderPriceModal(card) {
  if (!card || !card.pricing) return 'No price data';
  const p = card.pricing;
  const jp = [], na = [], eu = [];

  // JP sources (v2)
  if (p.sources) {
    const srcNames = {surugaya:'駿河屋',yuyutei:'遊々亭',cardrush:'カードラッシュ',mercari:'メルカリ',amazonjp:'Amazon JP',rarity:'Rarity'};
    for (const [src, data] of Object.entries(p.sources)) {
      if (data && data.jpy) jp.push({name: srcNames[src]||src, jpy: data.jpy, stock: data.in_stock !== false, src: src});
    }
  }
  // Legacy JP
  if (p.amazonjp && p.amazonjp.jpy && !jp.find(s=>s.name==='Amazon JP')) jp.push({name:'Amazon JP', jpy:p.amazonjp.jpy, stock:true, src:'amazonjp'});
  if (p.mercari && p.mercari.jpy && !jp.find(s=>s.name==='メルカリ')) jp.push({name:'メルカリ', jpy:p.mercari.jpy, stock:true, src:'mercari'});
  // NA
  if (p.usd) na.push({name:'limitlesstcg', raw:'$'+p.usd.toFixed(2)});
  if (p.tcgplayer) {
    const tp = p.tcgplayer.normal || p.tcgplayer.holofoil;
    if (tp && tp.marketPrice) na.push({name:'TCGPlayer', raw:'$'+tp.marketPrice.toFixed(2)});
  }
  // EU
  if (p.cardmarket && p.cardmarket.trend) eu.push({name:'Cardmarket', raw:'€'+p.cardmarket.trend.toFixed(2)});

  const jpPrices = jp.map(s=>s.jpy).sort((a,b)=>a-b);
  const floor = jpPrices[0] || 0;
  const reference = jpPrices.length > 1 ? Math.round(jpPrices.reduce((a,b)=>a+b,0)/jpPrices.length) : floor;
  const buyBack = (p.regional && p.regional.JP) ? p.regional.JP.buy : null;

  if (!floor && !na.length && !eu.length) return 'No price data';

  let h = '<div style="margin-bottom:10px">';
  if (floor) {
    h += `<div style="font-size:1.2em;font-weight:bold;color:#2e7d32">Best Price: ¥${floor.toLocaleString()}</div>`;
    if (reference && reference !== floor) h += `<div style="font-size:.9em;color:#666">Market: ¥${reference.toLocaleString()}</div>`;
    if (buyBack) h += `<div style="font-size:.85em;color:#888">Buy-back: ¥${buyBack.toLocaleString()}</div>`;
  }
  h += '</div>';

  // JP sources
  if (jp.length) {
    h += '<div style="font-size:.8em;color:#555;margin-bottom:2px">🇯🇵 Japan</div>';
    jp.sort((a,b)=>a.jpy-b.jpy);
    const searchQ = encodeURIComponent(card.id || '');
    h += jp.map(s => {
      const stockDot = s.stock ? '<span style="color:#4caf50">●</span>' : '<span style="color:#ccc">○</span>';
      const isFloor = s.jpy === floor;
      let url = '#';
      if (s.src === 'surugaya') url = `https://www.suruga-ya.jp/search?category=&search_word=${searchQ}&restrict%5B%5D=categorygroup_6`;
      else if (s.src === 'yuyutei') url = `https://yuyu-tei.jp/sell/opc/s/search?search_word=${searchQ}`;
      else if (s.src === 'cardrush') url = `https://www.cardrush-op.jp/product-list?keyword=${searchQ}`;
      else if (s.src === 'amazonjp') url = `https://www.amazon.co.jp/s?k=${encodeURIComponent((card.id||'')+' ワンピースカード')}`;
      else if (s.src === 'mercari') url = `https://jp.mercari.com/search?keyword=${searchQ}`;
      return `<div style="font-size:.85em;padding:1px 0;${isFloor?'font-weight:600':''}"><a href="${url}" target="_blank" style="color:#1976d2;text-decoration:none;display:inline-block;width:110px">${s.name}</a> ¥${s.jpy.toLocaleString()} ${stockDot}</div>`;
    }).join('');
  }
  // NA
  if (na.length) {
    h += '<div style="font-size:.8em;color:#555;margin-top:8px;margin-bottom:2px">🇺🇸 NA</div>';
    h += na.map(s => `<div style="font-size:.85em;padding:1px 0"><span style="display:inline-block;width:110px;color:#444">${s.name}</span> ${s.raw}</div>`).join('');
  }
  // EU
  if (eu.length) {
    h += '<div style="font-size:.8em;color:#555;margin-top:8px;margin-bottom:2px">🇪🇺 EU</div>';
    h += eu.map(s => `<div style="font-size:.85em;padding:1px 0"><span style="display:inline-block;width:110px;color:#444">${s.name}</span> ${s.raw}</div>`).join('');
  }
  // Updated
  const updated = p.updated || (p.regional && p.regional.JP && p.regional.JP.updated);
  if (updated) h += `<div style="font-size:.75em;color:#aaa;margin-top:8px">Updated: ${updated}</div>`;

  return h;
}
