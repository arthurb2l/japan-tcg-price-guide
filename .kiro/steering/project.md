---
inclusion: always
---

# Japan TCG Price Guide — Project Steering

## Identity
- **Repo:** arthurb2l/japan-tcg-price-guide
- **Live:** https://arthurb2l.github.io/japan-tcg-price-guide/
- **Hosting:** GitHub Pages (NOT Vercel)
- **Path:** /mnt/c/q/Pokemon/

## Deployment
- GitHub Pages deploys from `main` branch automatically
- No Vercel — skip Vercel deploy checks from cross-project rules
- After push: verify via `curl -s -o /dev/null -w "%{http_code}" https://arthurb2l.github.io/japan-tcg-price-guide/`
- Git state: detached HEAD, push with `git push origin HEAD:main`
- Always `git fetch origin main && git rebase origin/main` before push

## Data Model
- One Piece: `data/onepiece-cache.json` (single file, ~2800 cards)
- Pokemon: `data/shards/*.json` (split by era: bw, dp, ex, sm, sv, swsh, vintage, xy)
- Pricing: `{jpy, usd, source, updated}` — JPY floor price is authoritative
- Audit: `{verified, source, priceConfidence}` on every card

## Key Rules
- **Floor pricing** — always use lowest reliable JP domestic price, not median
- **Never delete original images** — backups in `_originals/` directories
- **Audit files are LOCAL-ONLY** — `onepiece/images/audit/` is for tooling, never linked from live site
- **Private files (gitignored):** BACKLOG.md, ARCHIVE.md
- **Save mapping progress to git** — `don-mapping-progress.json`, not just localStorage

## Image Extraction from PDFs
- Use `pdfimages` to extract individual cards (CMYK), then invert + convert to RGB
- Full methodology: `docs/IMAGE-AUDIT-METHODOLOGY.md`
- Never use `pdftoppm` for card cropping (grid positions unreliable)

## Scripts
- `scripts/audit-inventory.js` — health scores (variants, gaps, prices)
- `scripts/validate-prices.js` — price anomaly detection
- `scripts/fetch-pokemon-prices.js` — TCGdex price fetcher
- `scripts/fetch-pokemon-metadata.js` — TCGdex rarity+image fetcher
- `scripts/fetch-op-official-cardlist.js` — One Piece card list from official site (POST scraper)

## One Piece Card List Methodology
- **Source of truth:** `onepiece-cardgame.com/cardlist/` (POST with `series=<id>`)
- **Variant pattern:** `CARD-ID_p1`, `_p2` etc. = parallel/alternate art versions
- **Script:** `node scripts/fetch-op-official-cardlist.js <series_id> --dry-run`
- **Series IDs:** Found in the `<select>` dropdown on the official card list page
- **Always check official site** before assuming a set is complete — variants are easily missed

## Autonomous Agents
- `.github/workflows/update-sitemap.yml` — auto-generates sitemap
- `.github/workflows/update-metrics.yml` — auto-updates card counts

## Current Focus
- DON card image audit: mapping 261 PDF images → 176 card IDs
- Progress tracked in `onepiece/images/audit/don-mapping-progress.json`
- Audit page: `onepiece/images/audit/don-audit.html`
