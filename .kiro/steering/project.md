---
inclusion: always
---

# Japan TCG Price Guide — Project Steering

## Identity
- **Repo:** arthurb2l/japan-tcg-price-guide
- **Live:** https://arthurb2l.github.io/japan-tcg-price-guide/
- **Hosting:** GitHub Pages (NOT Vercel)
- **Path:** /mnt/c/q/projects/pokemon/

## Deployment
- GitHub Pages deploys from `main` branch automatically
- No Vercel — skip Vercel deploy checks from cross-project rules
- After push: verify via `curl -s -o /dev/null -w "%{http_code}" https://arthurb2l.github.io/japan-tcg-price-guide/`
- Git state: detached HEAD, push with `git push origin HEAD:main`
- Always `git fetch origin main && git rebase origin/main` before push

## Data Model
- One Piece: `data/onepiece-cache.json` (single file, ~3,861 cards across 21 sets + ST/DON/PROMO)
- Pokemon: `data/shards/*.json` (split by era: bw, dp, ex, sm, sv, swsh, vintage, xy)
- Pricing: `{jpy, usd, source, updated}` — JPY floor price is authoritative
- Audit: `{verified, source, priceConfidence}` on every card
- Variants: `{finish, variant}` — finish = technical type (parallel-1), variant = human name (Manga)

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
- **Variant pattern:** Official site uses suffixes on card IDs:
  - `_p1`, `_p2`, `_p3` = parallel/alternate art versions (type varies per card)
  - `_r1` = reprint in premium booster sets
  - A card can appear across multiple sets (e.g. EB02-061 in EB-02 AND PRB-02 with different `_p` numbers)
- **Script:** `node scripts/fetch-op-official-cardlist.js <series_id> --dry-run`
- **Series IDs:** Found in the `<select>` dropdown on the official card list page
- **Always check official site** before assuming a set is complete — variants are easily missed
- **Variant naming:** Each parallel must have a `variant` field with a human-readable name:
  - `_p` suffix numbers do NOT indicate a consistent variant type — must be visually verified
  - Common OP variant types: Regular, Extended Art (full bleed), Manga (B&W), SP (Special), Alternate Art
  - Cross-reference pricecharting.com for variant names AND visually confirm which `_p` image matches which name
  - Price cross-reference slug pattern: `name-variant-cardid` (e.g. `monkeydluffy-manga-eb02-061`)
- **Image mapping:** Each variant gets its own image URL: `{base_url}/{CARD-ID}_p{N}.png`

## Autonomous Agents
- `.github/workflows/update-sitemap.yml` — auto-generates sitemap
- `.github/workflows/update-metrics.yml` — auto-updates card counts

## Current Focus
- One Piece: 17/21 sets match official JP counts exactly (3,861 cards total)
- ~1,361 newly imported cards need prices (variant cards mostly)
- Variant `variant` field needs human-readable names for all sets (only EB-02 done)
- Pokemon: SV6a added (94 cards with prices), search `setId` normalization fixed
- **CRITICAL:** Never mix EN and JP card lists — JP official site is the only source

## Deal Hunter — pricing pipeline safety (learned 2026-04-17)
- **Sanity filter is mandatory** — drop listings <20% of DB price BEFORE consensus. Without it, damaged/sold-out/wrong-card listings poison the pool.
- **Guardrails before root-cause fix** — when a data pipeline corrupts its own store, ship overrides/blocklist/flip-guards IMMEDIATELY to stop damage, then fix the real bug.
- **Consensus requires 3+ sources** (not 2). Two noisy scrapers agreeing on a bad match is trivially common.
- **Flip-guard** — if a card was corrected within 7 days in the opposite direction, require 4+ sources + >50% divergence to flip it. Cheap ping-pong detector.
- **Every correction logged** to `data/deal-hunter-correction-history.jsonl` so patterns are visible.
- **JP retailers don't use `_p1/_p2` suffixes in listings** — those are internal Bandai IDs. Matching must use exact card ID + keyword heuristics for variant classification.
- **Files:** `data/deal-hunter-overrides.json` (manual locks), `data/deal-hunter-blocklist.json` (time-boxed exclusions)

## UI debugging heuristic (learned 2026-04-17)
- Before debugging visual inconsistency between similar components, grep for CSS rules matching each class name across all files. A component with ZERO matching rules is using browser defaults — this is almost always the root cause, not cascade or specificity issues.
- Stale tickets (>2 weeks old) need current-state audit before starting. Post a Status+Evidence table to the issue — don't trust the original problem list.
