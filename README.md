# 🎴 Japanese Pokemon Card Price Guide

**Free price guide for hunting Pokemon card deals at Japanese flea markets, Hard-Off, and recycle shops.**

[![Live Demo](https://img.shields.io/badge/🔗_Live_Demo-GitHub_Pages-blue)](https://arthurb2l.github.io/japan-pokemon-card-price-guide/)

## 🔥 What's Inside

- **Vintage Cards (1996-2002)** — No Rarity symbols, Gold Stars, e-Card holos
- **Modern Chase Cards** — Iono SAR, Umbreon VMAX Alt Art, Charizard ex SAR
- **Japan-Exclusive Promos** — Pokemon Center Pikachus, Poncho Pikachus, Yu Nagaba
- **Booster Pack Values** — Which packs to buy at flea markets
- **Sealed Box Prices** — Investment-grade Japanese boxes
- **Quick ID Tips** — 5-second checks to spot valuable cards

## 📱 Use Case

Open on your phone while browsing:
- Japanese flea markets (フリマ)
- Hard-Off / Book-Off
- Recycle shops (リサイクルショップ)
- Mandarake, Surugaya

## 💰 Price Tags

Every card shows:
- `💰 Buy under ¥X` — Maximum price for a good deal
- `🔥 Nx flip` — Profit potential multiplier
- `JP Exclusive` — Japan-only cards

## 🇯🇵 Japanese Card Names

All cards show Japanese names in purple (e.g., リザードン = Charizard) so you can match physical cards.

## 📊 Data Sources

- **US Market Prices**: [PokemonPriceTracker API](https://www.pokemonpricetracker.com/) (auto-updated monthly)
- **JP Flea Market Targets**: Manual research at Tokyo flea markets, Hard-Off, Book-Off

See [How We Price](/guides/pricing-methodology.html) for full methodology.

## 🤖 Autonomous Agents

This site runs on GitHub Actions agents that work without manual intervention:

| Agent | Schedule | Function |
|-------|----------|----------|
| Sitemap Refresher | On push | Regenerates sitemap.xml |
| Set Page Generator | On data change | Creates /sets/*.html from sets.json |
| Health Check | Weekly | Verifies all pages return 200 |
| Best Packs Ranker | Weekly | Re-sorts best-packs.html by EV |
| Price Updater | Monthly | Fetches USD prices from API |

### Price API (Free Tier)
- **Provider**: PokemonPriceTracker.com
- **Limits**: 100 credits/day, 60 calls/min
- **Our usage**: ~20 credits/month (well under limit)
- **Failsafe**: Agent skips gracefully if API unavailable; site works with last known prices

To enable: Add `POKEMON_API_KEY` secret to repo settings.

---

**Last updated:** March 2026

⭐ **Star this repo** if it helps you find deals!
