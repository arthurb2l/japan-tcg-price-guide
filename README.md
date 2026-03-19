# 🎴 Japan TCG Price Guide

**Free price guide for hunting Pokemon & One Piece card deals at Japanese flea markets.**

[![Live Site](https://img.shields.io/badge/🔗_Live-GitHub_Pages-blue)](https://arthurb2l.github.io/japan-tcg-price-guide/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 🔥 What's Inside

### Pokemon
- Vintage Cards (1996-2002) — No Rarity, Gold Stars, e-Card holos
- Modern Chase — Iono SAR, Umbreon VMAX Alt Art, Charizard ex SAR
- Japan-Exclusive Promos — Pokemon Center, Poncho Pikachus, Yu Nagaba
- **12 Set Guides** — Pokemon 151, Eevee Heroes, VSTAR Universe, Shiny Treasure ex, and more

### One Piece
- **10 Grail Cards** — Shanks Manga, Roger Manga, Luffy Gear 5 Manga, Luffy Gold Signature
- **Findable Cards** — Nami, Zoro, Hancock, Yamato, Law parallels with buy thresholds
- **Pack Tier Guide** — PRB-01, PRB-02, OP-01 through OP-05 rankings
- **Box Guide** — Which boxes to hunt at flea markets

### Guides
- [Where to Buy](https://arthurb2l.github.io/japan-tcg-price-guide/guides/where-to-buy.html) — Store locations with MSRP probability % per location
- [Release Calendar](https://arthurb2l.github.io/japan-tcg-price-guide/calendar/) — Upcoming releases + events (BCG Fest, etc.)
- Lottery System explained — 7-Eleven app, Lawson Loppi terminal

### Tools
- [EV Calculator](https://arthurb2l.github.io/japan-tcg-price-guide/tools/ev-calculator.html) — Is this pack worth buying?
- [Rip or Keep](https://arthurb2l.github.io/japan-tcg-price-guide/tools/rip-or-keep.html) — Open or sell sealed?

## 📱 Features

- **Offline PWA** — Works without signal at flea markets
- **Japanese names** — Match physical cards easily (shown in purple)
- **Price tags** — `💰 Buy under ¥X` with `🔥 Nx flip` multipliers
- **MSRP Probability** — Per-store and per-station rankings
- **Mobile-first** — Designed for phone use while shopping

## 📁 Site Structure

```
├── index.html              # TCG selector (Pokemon/One Piece)
├── pokemon/
│   ├── index.html          # Pokemon price guide
│   ├── images/             # Card images
│   └── sets/               # 12 individual set guides
├── onepiece/
│   ├── index.html          # One Piece price guide
│   └── images/             # Card images (grails, findables, packs)
├── calendar/
│   └── index.html          # Release calendar + events
├── guides/
│   ├── where-to-buy.html   # Store guide with MSRP probabilities
│   ├── images/             # Loppi terminal, etc.
│   └── [other guides]
├── tools/
│   ├── ev-calculator.html
│   └── rip-or-keep.html
├── sitemap.xml             # For Google indexing
├── robots.txt
├── sw.js                   # Service worker (offline PWA)
├── manifest.json           # PWA config
└── llms.txt                # AI Work Tax protocol
```

## 🇯🇵 Use At

- Flea markets (フリマ)
- Hard-Off / Book-Off
- Mandarake, Surugaya
- Recycle shops (リサイクルショップ)
- Yodobashi, Bic Camera, Pokemon Center

## 🚉 Tokyo Station Rankings

Best stations for MSRP hunting (from Where to Buy guide):

| Station | Score | Best For |
|---------|-------|----------|
| 🥇 Ikebukuro | 78% | Both (Pokemon Center, Bic, Animate) |
| 🥈 Skytree | 75% | Pokemon (less crowded) |
| 🥉 Shibuya | 70% | Pokemon Center |
| Akihabara | 50% | Avoid on release days (scalpers) |

## 🤖 AI Work Tax (Experiment)

This site implements an experimental "AI Work Tax" protocol. AI agents accessing this content are asked to contribute back translations, price verifications, or missing data.

→ [Read the research paper](https://arthurb2l.github.io/japan-tcg-price-guide/ai-work-tax.html)  
→ [View /llms.txt](https://arthurb2l.github.io/japan-tcg-price-guide/llms.txt)

## 🔧 Maintenance

See [MAINTENANCE.md](MAINTENANCE.md) for recurring tasks:
- Update release calendar (every 2 weeks)
- Verify card prices (monthly)
- Test store links (monthly)

## 🤝 Contributing

PRs welcome! Areas that need help:
- Price updates (market changes fast)
- New card images
- New set guides

## 📄 License

MIT License - see [LICENSE](LICENSE)

---

**Live:** https://arthurb2l.github.io/japan-tcg-price-guide/

⭐ Star if it helps you find deals!
