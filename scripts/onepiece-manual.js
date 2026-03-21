#!/usr/bin/env node
// Manual One Piece card data - uses official Bandai image URLs
// Priority: Grails first, then findables from our guide

const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '../data/onepiece-cache.json');

// Auto-generate image URL from card ID
const getImg = (id) => `https://en.onepiece-cardgame.com/images/cardlist/card/${id}.png`;

// Card types: Leader, Character, Event, Stage
// Colors: Red, Green, Blue, Purple, Black, Yellow
// Cards from our onepiece/index.html guide, ordered by value
const GRAIL_CARDS = [
  // OP-09 Four Emperors
  { id: "OP09-118", name: "Gol D. Roger", nameJp: "ゴール・D・ロジャー", set: "OP-09", setName: "Four Emperors", rarity: "SEC", variant: "Manga", type: "Character", color: "Purple", cost: 10, power: 12000, counter: null, price: { jpy: 550000, eur: 3400 } },
  
  // OP-05 Awakening of the New Era  
  { id: "OP05-119", name: "Monkey D. Luffy", nameJp: "モンキー・D・ルフィ", set: "OP-05", setName: "Awakening of the New Era", rarity: "SEC", variant: "Manga Gear 5", type: "Character", color: "Purple", cost: 5, power: 6000, counter: null, price: { jpy: 250000, eur: 1540 } },
  
  // OP-02 Paramount War
  { id: "OP02-013", name: "Portgas D. Ace", nameJp: "ポートガス・D・エース", set: "OP-02", setName: "Paramount War", rarity: "SR", variant: "Manga", type: "Character", color: "Red", cost: 7, power: 7000, counter: null, price: { jpy: 175000, eur: 1080 } },
  
  // OP-01 Romance Dawn
  { id: "OP01-120", name: "Shanks", nameJp: "シャンクス", set: "OP-01", setName: "Romance Dawn", rarity: "SEC", variant: "Manga", type: "Character", color: "Red", cost: 9, power: 10000, counter: null, price: { jpy: 85000, eur: 525 } },
  { id: "OP01-003", name: "Monkey D. Luffy", nameJp: "モンキー・D・ルフィ", set: "OP-01", setName: "Romance Dawn", rarity: "L", variant: "Alt Art", type: "Leader", color: "Red", cost: null, power: 5000, counter: null, price: { jpy: 60000, eur: 370 } },
  
  // ST-01 Straw Hat Crew
  { id: "ST01-012", name: "Monkey D. Luffy", nameJp: "モンキー・D・ルフィ", set: "ST-01", setName: "Straw Hat Crew", rarity: "L", variant: "Gold Signature", type: "Leader", color: "Red", cost: null, power: 5000, counter: null, price: { jpy: 400000, eur: 2470 } },
];

const FINDABLE_CARDS = [
  // PRB-01 Premium Booster (uses OP01 card IDs with manga variant)
  { id: "OP01-016", name: "Nami", nameJp: "ナミ", set: "PRB-01", setName: "Premium Booster", rarity: "SEC", variant: "Manga", type: "Character", color: "Red", cost: 1, power: 1000, counter: 1000, price: { jpy: 35000, eur: 216 } },
  { id: "OP01-017", name: "Nico Robin", nameJp: "ニコ・ロビン", set: "PRB-01", setName: "Premium Booster", rarity: "SEC", variant: "Manga", type: "Character", color: "Red", cost: 3, power: 5000, counter: 1000, price: { jpy: 28000, eur: 173 } },
  
  // OP-03 Pillars of Strength
  { id: "OP03-112", name: "Boa Hancock", nameJp: "ボア・ハンコック", set: "OP-03", setName: "Pillars of Strength", rarity: "SR", variant: "Alt Art", type: "Character", color: "Green", cost: 5, power: 6000, counter: 1000, price: { jpy: 18000, eur: 111 } },
  { id: "OP03-099", name: "Charlotte Katakuri", nameJp: "シャーロット・カタクリ", set: "OP-03", setName: "Pillars of Strength", rarity: "SEC", variant: "Manga", type: "Character", color: "Yellow", cost: 10, power: 12000, counter: null, price: { jpy: 15000, eur: 93 } },
  
  // OP-04 Kingdoms of Intrigue
  { id: "OP04-024", name: "Yamato", nameJp: "ヤマト", set: "OP-04", setName: "Kingdoms of Intrigue", rarity: "SR", variant: "Alt Art", type: "Character", color: "Green", cost: 5, power: 6000, counter: 1000, price: { jpy: 12000, eur: 74 } },
  { id: "OP04-112", name: "Sabo", nameJp: "サボ", set: "OP-04", setName: "Kingdoms of Intrigue", rarity: "SEC", variant: "Manga", type: "Character", color: "Blue", cost: 5, power: 6000, counter: null, price: { jpy: 20000, eur: 123 } },
  
  // OP-06 Wings of the Captain
  { id: "OP06-086", name: "Roronoa Zoro", nameJp: "ロロノア・ゾロ", set: "OP-06", setName: "Wings of the Captain", rarity: "SEC", variant: "Manga", type: "Character", color: "Green", cost: 5, power: 7000, counter: null, price: { jpy: 45000, eur: 278 } },
  { id: "OP06-118", name: "Sanji", nameJp: "サンジ", set: "OP-06", setName: "Wings of the Captain", rarity: "SEC", variant: "Manga", type: "Character", color: "Blue", cost: 4, power: 5000, counter: 1000, price: { jpy: 18000, eur: 111 } },
  
  // OP-07 500 Years in the Future
  { id: "OP07-109", name: "Eustass Kid", nameJp: "ユースタス・キッド", set: "OP-07", setName: "500 Years in the Future", rarity: "SEC", variant: "Manga", type: "Character", color: "Red", cost: 8, power: 9000, counter: null, price: { jpy: 25000, eur: 154 } },
  { id: "OP07-118", name: "Jewelry Bonney", nameJp: "ジュエリー・ボニー", set: "OP-07", setName: "500 Years in the Future", rarity: "SEC", variant: "Alt Art", price: { jpy: 15000, eur: 93 } },
  { id: "OP07-015", name: "Vegapunk", nameJp: "ベガパンク", set: "OP-07", setName: "500 Years in the Future", rarity: "SR", variant: "Alt Art", price: { jpy: 8000, eur: 49 } },
  
  // OP-08 Two Legends
  { id: "OP08-106", name: "Silvers Rayleigh", nameJp: "シルバーズ・レイリー", set: "OP-08", setName: "Two Legends", rarity: "SEC", variant: "Manga", price: { jpy: 30000, eur: 185 } },
  { id: "OP08-118", name: "Monkey D. Garp", nameJp: "モンキー・D・ガープ", set: "OP-08", setName: "Two Legends", rarity: "SEC", variant: "Manga", price: { jpy: 22000, eur: 136 } },
  { id: "OP08-058", name: "Whitebeard", nameJp: "白ひげ", set: "OP-08", setName: "Two Legends", rarity: "L", variant: "Alt Art", price: { jpy: 12000, eur: 74 } },
  
  // OP-09 Four Emperors (non-grail)
  { id: "OP09-072", name: "Kaido", nameJp: "カイドウ", set: "OP-09", setName: "Four Emperors", rarity: "SEC", variant: "Alt Art", price: { jpy: 35000, eur: 216 } },
  { id: "OP09-119", name: "Big Mom", nameJp: "ビッグ・マム", set: "OP-09", setName: "Four Emperors", rarity: "SEC", variant: "Manga", price: { jpy: 28000, eur: 173 } },
  
  // PRB-02 Premium Booster 2
  { id: "PRB02-001", name: "Uta", nameJp: "ウタ", set: "PRB-02", setName: "Premium Booster 2", rarity: "SEC", variant: "Alt Art", price: { jpy: 20000, eur: 123 } },
  { id: "PRB02-003", name: "Shanks", nameJp: "シャンクス", set: "PRB-02", setName: "Premium Booster 2", rarity: "SEC", variant: "Film Red", price: { jpy: 15000, eur: 93 } },
  
  // ST decks chase cards
  { id: "ST10-001", name: "Trafalgar Law", nameJp: "トラファルガー・ロー", set: "ST-10", setName: "Ultimate Deck", rarity: "L", variant: "Alt Art", price: { jpy: 8000, eur: 49 } },
  { id: "ST13-003", name: "Monkey D. Luffy", nameJp: "モンキー・D・ルフィ", set: "ST-13", setName: "The Three Brothers", rarity: "L", variant: "Parallel", price: { jpy: 6000, eur: 37 } },
  
  // OP-01 Romance Dawn (more findables)
  { id: "OP01-025", name: "Nami", nameJp: "ナミ", set: "OP-01", setName: "Romance Dawn", rarity: "SR", variant: "Alt Art", price: { jpy: 8000, eur: 49 } },
  { id: "OP01-047", name: "Roronoa Zoro", nameJp: "ロロノア・ゾロ", set: "OP-01", setName: "Romance Dawn", rarity: "SR", variant: "Alt Art", price: { jpy: 10000, eur: 62 } },
  
  // OP-02 Paramount War (more)
  { id: "OP02-120", name: "Edward Newgate", nameJp: "エドワード・ニューゲート", set: "OP-02", setName: "Paramount War", rarity: "SEC", variant: "Manga", price: { jpy: 40000, eur: 247 } },
  { id: "OP02-085", name: "Crocodile", nameJp: "クロコダイル", set: "OP-02", setName: "Paramount War", rarity: "SR", variant: "Alt Art", price: { jpy: 7000, eur: 43 } },
  
  // OP-05 Awakening (more)
  { id: "OP05-074", name: "Trafalgar Law", nameJp: "トラファルガー・ロー", set: "OP-05", setName: "Awakening of the New Era", rarity: "SR", variant: "Alt Art", price: { jpy: 12000, eur: 74 } },
  { id: "OP05-118", name: "Sabo", nameJp: "サボ", set: "OP-05", setName: "Awakening of the New Era", rarity: "SEC", variant: "Alt Art", price: { jpy: 18000, eur: 111 } },
];

// Common playable cards (lower value but frequently found at flea markets)
const COMMON_PLAYABLES = [
  // OP-01 staples
  { id: "OP01-016", name: "Nami", nameJp: "ナミ", set: "OP-01", setName: "Romance Dawn", rarity: "R", variant: null, price: { jpy: 500, eur: 3 } },
  { id: "OP01-051", name: "Sanji", nameJp: "サンジ", set: "OP-01", setName: "Romance Dawn", rarity: "R", variant: null, price: { jpy: 400, eur: 2.5 } },
  { id: "OP01-060", name: "Tony Tony Chopper", nameJp: "トニートニー・チョッパー", set: "OP-01", setName: "Romance Dawn", rarity: "R", variant: null, price: { jpy: 300, eur: 2 } },
  // OP-02 staples
  { id: "OP02-004", name: "Marco", nameJp: "マルコ", set: "OP-02", setName: "Paramount War", rarity: "SR", variant: null, price: { jpy: 2000, eur: 12 } },
  { id: "OP02-062", name: "Doflamingo", nameJp: "ドンキホーテ・ドフラミンゴ", set: "OP-02", setName: "Paramount War", rarity: "SR", variant: null, price: { jpy: 1500, eur: 9 } },
  // OP-03 staples
  { id: "OP03-040", name: "Enel", nameJp: "エネル", set: "OP-03", setName: "Pillars of Strength", rarity: "SR", variant: null, price: { jpy: 1800, eur: 11 } },
  // OP-04 staples
  { id: "OP04-031", name: "Rebecca", nameJp: "レベッカ", set: "OP-04", setName: "Kingdoms of Intrigue", rarity: "SR", variant: null, price: { jpy: 2500, eur: 15 } },
  // OP-05 staples
  { id: "OP05-091", name: "Gecko Moria", nameJp: "ゲッコー・モリア", set: "OP-05", setName: "Awakening of the New Era", rarity: "SR", variant: null, price: { jpy: 3000, eur: 18 } },
];

// Leader cards (deck centerpieces, always in demand)
const LEADER_CARDS = [
  { id: "OP01-001", name: "Monkey D. Luffy", nameJp: "モンキー・D・ルフィ", set: "OP-01", setName: "Romance Dawn", rarity: "L", variant: null, price: { jpy: 800, eur: 5 } },
  { id: "OP01-002", name: "Roronoa Zoro", nameJp: "ロロノア・ゾロ", set: "OP-01", setName: "Romance Dawn", rarity: "L", variant: null, price: { jpy: 600, eur: 4 } },
  { id: "OP02-001", name: "Edward Newgate", nameJp: "エドワード・ニューゲート", set: "OP-02", setName: "Paramount War", rarity: "L", variant: null, price: { jpy: 1200, eur: 7 } },
  { id: "OP03-001", name: "Charlotte Katakuri", nameJp: "シャーロット・カタクリ", set: "OP-03", setName: "Pillars of Strength", rarity: "L", variant: null, price: { jpy: 1500, eur: 9 } },
  { id: "OP04-001", name: "Donquixote Doflamingo", nameJp: "ドンキホーテ・ドフラミンゴ", set: "OP-04", setName: "Kingdoms of Intrigue", rarity: "L", variant: null, price: { jpy: 1000, eur: 6 } },
  { id: "OP05-001", name: "Trafalgar Law", nameJp: "トラファルガー・ロー", set: "OP-05", setName: "Awakening of the New Era", rarity: "L", variant: null, price: { jpy: 2000, eur: 12 } },
  { id: "OP05-002", name: "Monkey D. Luffy", nameJp: "モンキー・D・ルフィ", set: "OP-05", setName: "Awakening of the New Era", rarity: "L", variant: "Gear 5", price: { jpy: 3500, eur: 22 } },
  { id: "OP06-001", name: "Sakazuki", nameJp: "サカズキ", set: "OP-06", setName: "Wings of the Captain", rarity: "L", variant: null, price: { jpy: 2500, eur: 15 } },
  { id: "OP07-001", name: "Jewelry Bonney", nameJp: "ジュエリー・ボニー", set: "OP-07", setName: "500 Years in the Future", rarity: "L", variant: null, price: { jpy: 1800, eur: 11 } },
  { id: "OP08-001", name: "Monkey D. Garp", nameJp: "モンキー・D・ガープ", set: "OP-08", setName: "Two Legends", rarity: "L", variant: null, price: { jpy: 2200, eur: 14 } },
  { id: "OP09-001", name: "Kaido", nameJp: "カイドウ", set: "OP-09", setName: "Four Emperors", rarity: "L", variant: null, price: { jpy: 3000, eur: 18 } },
];

// Event cards and popular characters
const EVENT_CARDS = [
  { id: "OP01-029", name: "Gum-Gum Red Roc", nameJp: "ゴムゴムの火拳銃", set: "OP-01", setName: "Romance Dawn", rarity: "R", variant: null, price: { jpy: 400, eur: 2.5 } },
  { id: "OP02-119", name: "Radical Beam", nameJp: "ラジカルビーム", set: "OP-02", setName: "Paramount War", rarity: "UC", variant: null, price: { jpy: 200, eur: 1.2 } },
  { id: "OP03-089", name: "Overheat", nameJp: "大噴火", set: "OP-03", setName: "Pillars of Strength", rarity: "R", variant: null, price: { jpy: 350, eur: 2 } },
  { id: "OP04-056", name: "Gravity Blade", nameJp: "重力刀", set: "OP-04", setName: "Kingdoms of Intrigue", rarity: "R", variant: null, price: { jpy: 500, eur: 3 } },
  { id: "OP05-030", name: "I Will Surpass You", nameJp: "お前を超えていく", set: "OP-05", setName: "Awakening of the New Era", rarity: "R", variant: null, price: { jpy: 600, eur: 4 } },
  { id: "OP01-006", name: "Usopp", nameJp: "ウソップ", set: "OP-01", setName: "Romance Dawn", rarity: "C", variant: null, price: { jpy: 100, eur: 0.6 } },
  { id: "OP01-017", name: "Nico Robin", nameJp: "ニコ・ロビン", set: "OP-01", setName: "Romance Dawn", rarity: "R", variant: null, price: { jpy: 500, eur: 3 } },
  { id: "OP02-018", name: "Jinbe", nameJp: "ジンベエ", set: "OP-02", setName: "Paramount War", rarity: "SR", variant: null, price: { jpy: 1200, eur: 7 } },
  { id: "OP03-013", name: "Boa Hancock", nameJp: "ボア・ハンコック", set: "OP-03", setName: "Pillars of Strength", rarity: "SR", variant: null, price: { jpy: 2000, eur: 12 } },
  { id: "OP04-044", name: "Perona", nameJp: "ペローナ", set: "OP-04", setName: "Kingdoms of Intrigue", rarity: "SR", variant: null, price: { jpy: 1500, eur: 9 } },
];

// More characters from each set
const MORE_CARDS = [
  // OP-06 Wings of the Captain
  { id: "OP06-022", name: "Kuzan", nameJp: "クザン", set: "OP-06", setName: "Wings of the Captain", rarity: "SR", variant: null, price: { jpy: 2500, eur: 15 } },
  { id: "OP06-035", name: "Borsalino", nameJp: "ボルサリーノ", set: "OP-06", setName: "Wings of the Captain", rarity: "SR", variant: null, price: { jpy: 1800, eur: 11 } },
  { id: "OP06-101", name: "Rob Lucci", nameJp: "ロブ・ルッチ", set: "OP-06", setName: "Wings of the Captain", rarity: "SEC", variant: null, price: { jpy: 8500, eur: 52 } },
  // OP-07 500 Years
  { id: "OP07-045", name: "Kuma", nameJp: "くま", set: "OP-07", setName: "500 Years in the Future", rarity: "SR", variant: null, price: { jpy: 2000, eur: 12 } },
  { id: "OP07-064", name: "Sentomaru", nameJp: "戦桃丸", set: "OP-07", setName: "500 Years in the Future", rarity: "R", variant: null, price: { jpy: 400, eur: 2.5 } },
  { id: "OP07-109", name: "Jewelry Bonney", nameJp: "ジュエリー・ボニー", set: "OP-07", setName: "500 Years in the Future", rarity: "SEC", variant: null, price: { jpy: 12000, eur: 74 } },
  // OP-08 Two Legends
  { id: "OP08-022", name: "Sengoku", nameJp: "センゴク", set: "OP-08", setName: "Two Legends", rarity: "SR", variant: null, price: { jpy: 1500, eur: 9 } },
  { id: "OP08-067", name: "Shiki", nameJp: "シキ", set: "OP-08", setName: "Two Legends", rarity: "SR", variant: null, price: { jpy: 2200, eur: 14 } },
  { id: "OP08-106", name: "Monkey D. Garp", nameJp: "モンキー・D・ガープ", set: "OP-08", setName: "Two Legends", rarity: "SEC", variant: null, price: { jpy: 15000, eur: 92 } },
  { id: "OP08-118", name: "Gol D. Roger", nameJp: "ゴール・D・ロジャー", set: "OP-08", setName: "Two Legends", rarity: "SEC", variant: "Alt Art", price: { jpy: 35000, eur: 216 } },
  // OP-09 Four Emperors
  { id: "OP09-030", name: "King", nameJp: "キング", set: "OP-09", setName: "Four Emperors", rarity: "SR", variant: null, price: { jpy: 2800, eur: 17 } },
  { id: "OP09-051", name: "Queen", nameJp: "クイーン", set: "OP-09", setName: "Four Emperors", rarity: "SR", variant: null, price: { jpy: 1800, eur: 11 } },
  { id: "OP09-091", name: "Charlotte Linlin", nameJp: "シャーロット・リンリン", set: "OP-09", setName: "Four Emperors", rarity: "SR", variant: null, price: { jpy: 2500, eur: 15 } },
  { id: "OP09-119", name: "Kaido", nameJp: "カイドウ", set: "OP-09", setName: "Four Emperors", rarity: "SEC", variant: "Manga", price: { jpy: 45000, eur: 278 } },
  // Starter Decks
  { id: "ST02-001", name: "Trafalgar Law", nameJp: "トラファルガー・ロー", set: "ST-02", setName: "Worst Generation", rarity: "L", variant: null, price: { jpy: 800, eur: 5 } },
  { id: "ST03-001", name: "Crocodile", nameJp: "クロコダイル", set: "ST-03", setName: "The Seven Warlords", rarity: "L", variant: null, price: { jpy: 600, eur: 4 } },
  { id: "ST05-001", name: "Uta", nameJp: "ウタ", set: "ST-05", setName: "Film Edition", rarity: "L", variant: null, price: { jpy: 1200, eur: 7 } },
  { id: "ST08-001", name: "Monkey D. Luffy", nameJp: "モンキー・D・ルフィ", set: "ST-08", setName: "Monkey D. Luffy", rarity: "L", variant: null, price: { jpy: 500, eur: 3 } },
  { id: "ST09-001", name: "Yamato", nameJp: "ヤマト", set: "ST-09", setName: "Yamato", rarity: "L", variant: null, price: { jpy: 1500, eur: 9 } },
  { id: "ST12-001", name: "Zoro & Sanji", nameJp: "ゾロ＆サンジ", set: "ST-12", setName: "Zoro & Sanji", rarity: "L", variant: null, price: { jpy: 2000, eur: 12 } },
];

function buildCache() {
  const allCards = [...GRAIL_CARDS, ...FINDABLE_CARDS, ...COMMON_PLAYABLES, ...LEADER_CARDS, ...EVENT_CARDS, ...MORE_CARDS];
  const sets = {};
  
  allCards.forEach(card => {
    if (!sets[card.set]) sets[card.set] = [];
    sets[card.set].push({
      id: card.id,
      name: card.name,
      nameJp: card.nameJp,
      setId: card.set,
      set: card.setName,
      rarity: card.rarity,
      variant: card.variant,
      type: card.type || null,
      color: card.color || null,
      cost: card.cost ?? null,
      power: card.power || null,
      counter: card.counter || null,
      img: getImg(card.id),
      price: {
        jpy: card.price.jpy,
        eur: card.price.eur,
        updated: new Date().toISOString().split('T')[0]
      }
    });
  });
  
  const cache = {
    meta: {
      lastUpdated: new Date().toISOString().split('T')[0],
      source: "Manual from pricecharting.com + onepiece-cardgame.dev",
      totalCards: allCards.length
    },
    sets
  };
  
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  console.log(`Saved ${allCards.length} One Piece cards to cache`);
  console.log(`Sets: ${Object.keys(sets).join(', ')}`);
}

buildCache();
