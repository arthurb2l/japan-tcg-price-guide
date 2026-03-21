#!/usr/bin/env node
// Manual One Piece card data - no free API available
// Priority: Grails first, then findables from our guide

const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '../data/onepiece-cache.json');

// Cards from our onepiece/index.html guide, ordered by value
const GRAIL_CARDS = [
  // OP-09 Four Emperors
  { id: "OP09-118", name: "Gol D. Roger", nameJp: "ゴール・D・ロジャー", set: "OP-09", setName: "Four Emperors", rarity: "SEC", variant: "Manga", price: { jpy: 550000, eur: 3400 }, img: "https://onepiece-cardgame.dev/images/cards/OP09-118_p1.png" },
  
  // OP-05 Awakening of the New Era  
  { id: "OP05-119", name: "Monkey D. Luffy", nameJp: "モンキー・D・ルフィ", set: "OP-05", setName: "Awakening of the New Era", rarity: "SEC", variant: "Manga Gear 5", price: { jpy: 250000, eur: 1540 }, img: "https://onepiece-cardgame.dev/images/cards/OP05-119_p1.png" },
  
  // OP-02 Paramount War
  { id: "OP02-013", name: "Portgas D. Ace", nameJp: "ポートガス・D・エース", set: "OP-02", setName: "Paramount War", rarity: "SR", variant: "Manga", price: { jpy: 175000, eur: 1080 }, img: "https://onepiece-cardgame.dev/images/cards/OP02-013_p1.png" },
  
  // OP-01 Romance Dawn
  { id: "OP01-120", name: "Shanks", nameJp: "シャンクス", set: "OP-01", setName: "Romance Dawn", rarity: "SEC", variant: "Manga", price: { jpy: 85000, eur: 525 }, img: "https://onepiece-cardgame.dev/images/cards/OP01-120_p1.png" },
  { id: "OP01-003", name: "Monkey D. Luffy", nameJp: "モンキー・D・ルフィ", set: "OP-01", setName: "Romance Dawn", rarity: "L", variant: "Alt Art", price: { jpy: 60000, eur: 370 }, img: "https://onepiece-cardgame.dev/images/cards/OP01-003_p1.png" },
  
  // ST-01 Straw Hat Crew
  { id: "ST01-012", name: "Monkey D. Luffy", nameJp: "モンキー・D・ルフィ", set: "ST-01", setName: "Straw Hat Crew", rarity: "L", variant: "Gold Signature", price: { jpy: 400000, eur: 2470 }, img: "https://onepiece-cardgame.dev/images/cards/ST01-012_p1.png" },
];

const FINDABLE_CARDS = [
  // PRB-01 Premium Booster
  { id: "PRB01-001", name: "Nami", nameJp: "ナミ", set: "PRB-01", setName: "Premium Booster", rarity: "SEC", variant: "Manga", price: { jpy: 35000, eur: 216 }, img: null },
  { id: "PRB01-002", name: "Nico Robin", nameJp: "ニコ・ロビン", set: "PRB-01", setName: "Premium Booster", rarity: "SEC", variant: "Manga", price: { jpy: 28000, eur: 173 }, img: null },
  
  // OP-03 Pillars of Strength
  { id: "OP03-112", name: "Boa Hancock", nameJp: "ボア・ハンコック", set: "OP-03", setName: "Pillars of Strength", rarity: "SR", variant: "Alt Art", price: { jpy: 18000, eur: 111 }, img: null },
  { id: "OP03-099", name: "Charlotte Katakuri", nameJp: "シャーロット・カタクリ", set: "OP-03", setName: "Pillars of Strength", rarity: "SEC", variant: "Manga", price: { jpy: 15000, eur: 93 }, img: null },
  
  // OP-04 Kingdoms of Intrigue
  { id: "OP04-024", name: "Yamato", nameJp: "ヤマト", set: "OP-04", setName: "Kingdoms of Intrigue", rarity: "SR", variant: "Alt Art", price: { jpy: 12000, eur: 74 }, img: null },
  { id: "OP04-112", name: "Sabo", nameJp: "サボ", set: "OP-04", setName: "Kingdoms of Intrigue", rarity: "SEC", variant: "Manga", price: { jpy: 20000, eur: 123 }, img: null },
  
  // OP-06 Wings of the Captain
  { id: "OP06-086", name: "Roronoa Zoro", nameJp: "ロロノア・ゾロ", set: "OP-06", setName: "Wings of the Captain", rarity: "SEC", variant: "Manga", price: { jpy: 45000, eur: 278 }, img: null },
  { id: "OP06-118", name: "Sanji", nameJp: "サンジ", set: "OP-06", setName: "Wings of the Captain", rarity: "SEC", variant: "Manga", price: { jpy: 18000, eur: 111 }, img: null },
  
  // OP-07 500 Years in the Future
  { id: "OP07-109", name: "Eustass Kid", nameJp: "ユースタス・キッド", set: "OP-07", setName: "500 Years in the Future", rarity: "SEC", variant: "Manga", price: { jpy: 25000, eur: 154 }, img: null },
  { id: "OP07-118", name: "Jewelry Bonney", nameJp: "ジュエリー・ボニー", set: "OP-07", setName: "500 Years in the Future", rarity: "SEC", variant: "Alt Art", price: { jpy: 15000, eur: 93 }, img: null },
  { id: "OP07-015", name: "Vegapunk", nameJp: "ベガパンク", set: "OP-07", setName: "500 Years in the Future", rarity: "SR", variant: "Alt Art", price: { jpy: 8000, eur: 49 }, img: null },
  
  // OP-08 Two Legends
  { id: "OP08-106", name: "Silvers Rayleigh", nameJp: "シルバーズ・レイリー", set: "OP-08", setName: "Two Legends", rarity: "SEC", variant: "Manga", price: { jpy: 30000, eur: 185 }, img: null },
  { id: "OP08-118", name: "Monkey D. Garp", nameJp: "モンキー・D・ガープ", set: "OP-08", setName: "Two Legends", rarity: "SEC", variant: "Manga", price: { jpy: 22000, eur: 136 }, img: null },
  { id: "OP08-058", name: "Whitebeard", nameJp: "白ひげ", set: "OP-08", setName: "Two Legends", rarity: "L", variant: "Alt Art", price: { jpy: 12000, eur: 74 }, img: null },
  
  // OP-09 Four Emperors (non-grail)
  { id: "OP09-072", name: "Kaido", nameJp: "カイドウ", set: "OP-09", setName: "Four Emperors", rarity: "SEC", variant: "Alt Art", price: { jpy: 35000, eur: 216 }, img: null },
  { id: "OP09-119", name: "Big Mom", nameJp: "ビッグ・マム", set: "OP-09", setName: "Four Emperors", rarity: "SEC", variant: "Manga", price: { jpy: 28000, eur: 173 }, img: null },
  
  // PRB-02 Premium Booster 2
  { id: "PRB02-001", name: "Uta", nameJp: "ウタ", set: "PRB-02", setName: "Premium Booster 2", rarity: "SEC", variant: "Alt Art", price: { jpy: 20000, eur: 123 }, img: null },
  { id: "PRB02-003", name: "Shanks", nameJp: "シャンクス", set: "PRB-02", setName: "Premium Booster 2", rarity: "SEC", variant: "Film Red", price: { jpy: 15000, eur: 93 }, img: null },
  
  // ST decks chase cards
  { id: "ST10-001", name: "Trafalgar Law", nameJp: "トラファルガー・ロー", set: "ST-10", setName: "Ultimate Deck", rarity: "L", variant: "Alt Art", price: { jpy: 8000, eur: 49 }, img: null },
  { id: "ST13-003", name: "Monkey D. Luffy", nameJp: "モンキー・D・ルフィ", set: "ST-13", setName: "The Three Brothers", rarity: "L", variant: "Parallel", price: { jpy: 6000, eur: 37 }, img: null },
  
  // OP-01 Romance Dawn (more findables)
  { id: "OP01-025", name: "Nami", nameJp: "ナミ", set: "OP-01", setName: "Romance Dawn", rarity: "SR", variant: "Alt Art", price: { jpy: 8000, eur: 49 }, img: null },
  { id: "OP01-047", name: "Roronoa Zoro", nameJp: "ロロノア・ゾロ", set: "OP-01", setName: "Romance Dawn", rarity: "SR", variant: "Alt Art", price: { jpy: 10000, eur: 62 }, img: null },
  
  // OP-02 Paramount War (more)
  { id: "OP02-120", name: "Edward Newgate", nameJp: "エドワード・ニューゲート", set: "OP-02", setName: "Paramount War", rarity: "SEC", variant: "Manga", price: { jpy: 40000, eur: 247 }, img: null },
  { id: "OP02-085", name: "Crocodile", nameJp: "クロコダイル", set: "OP-02", setName: "Paramount War", rarity: "SR", variant: "Alt Art", price: { jpy: 7000, eur: 43 }, img: null },
  
  // OP-05 Awakening (more)
  { id: "OP05-074", name: "Trafalgar Law", nameJp: "トラファルガー・ロー", set: "OP-05", setName: "Awakening of the New Era", rarity: "SR", variant: "Alt Art", price: { jpy: 12000, eur: 74 }, img: null },
  { id: "OP05-118", name: "Sabo", nameJp: "サボ", set: "OP-05", setName: "Awakening of the New Era", rarity: "SEC", variant: "Alt Art", price: { jpy: 18000, eur: 111 }, img: null },
];

function buildCache() {
  const allCards = [...GRAIL_CARDS, ...FINDABLE_CARDS];
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
      img: card.img,
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
