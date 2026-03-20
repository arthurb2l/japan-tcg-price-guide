# Architecture

> Single source of truth for AI agents and contributors.

## File Structure

```
├── index.html                    # Landing page (Pokemon/One Piece selector)
├── search.html                   # Card search (Data Brain powered)
├── submit.html                   # AI Work Tax submission form
├── metrics.html                  # Site statistics dashboard
│
├── pokemon/
│   ├── index.html                # Pokemon price guide
│   ├── data/
│   │   ├── sets.json             # Set metadata
│   │   └── prices.json           # Curated price data
│   └── sets/                     # Individual set pages (12)
│
├── onepiece/
│   └── index.html                # One Piece price guide
│
├── guides/
│   ├── where-to-buy.html         # Store locations + map
│   ├── best-packs.html           # Pack rankings
│   └── [6 more guides]
│
├── tools/
│   ├── ev-calculator.html        # Expected value calculator
│   └── rip-or-keep.html          # Open vs sell decision tool
│
├── data/
│   ├── brain-cache.json          # Data Brain aggregated data
│   ├── source-metrics.json       # Per-source statistics
│   ├── contributions.json        # AI Work Tax submissions
│   ├── metrics.json              # Aggregated site metrics
│   └── submission-schema.json    # JSON schema for submissions
│
├── scripts/
│   ├── calculate-metrics.js      # Metrics aggregation
│   └── data-brain/
│       ├── index.js              # Main orchestrator
│       ├── cli.js                # CLI interface
│       └── sources/
│           ├── tcgdex.js         # ✅ Active
│           └── *.disabled.js     # Inactive adapters
│
├── docs/research/                # Academic documentation
│   ├── METHODOLOGY.md
│   ├── REPLICATION.md
│   ├── ETHICS.md
│   └── CITE.md
│
└── .github/workflows/
    ├── data-brain-sync.yml       # Daily data sync
    ├── self-healing.yml          # Weekly health + auto-issue
    ├── ai-work-tax-validator.yml # Validates submissions
    ├── update-metrics.yml        # Recalculates metrics
    ├── update-prices.yml         # Price updates
    ├── generate-set-pages.yml    # Auto-generate set pages
    ├── rank-best-packs.yml       # Pack ranking updates
    └── update-sitemap.yml        # SEO sitemap
```

## Data Flow

```
External APIs (TCGdex)
        ↓
   Data Brain (scripts/data-brain/)
        ↓
   brain-cache.json
        ↓
   search.html (client-side)
```

## Key Patterns

### No Build Step
All HTML is hand-written. No bundler, no framework. Each page has inline `<style>`.

### Offline-First PWA
- `sw.js` - Service worker caches all pages
- `manifest.json` - PWA config
- Works without internet at flea markets

### AI Work Tax
1. User/AI fills `submit.html` form
2. Form opens GitHub issue with JSON
3. `ai-work-tax-validator.yml` validates
4. Creates PR if valid
5. Merged → site grows

### Self-Healing
Weekly cron checks:
- Data freshness (>7 days = stale)
- API health (TCGdex)
- JSON validity
- Page 200 status

Creates issue if problems found.

## Adding Content

### New Set Page
1. Add to `pokemon/data/sets.json`
2. Run `generate-set-pages.yml` workflow
3. Or manually create `pokemon/sets/{set-id}.html`

### New Guide
1. Create `guides/{name}.html`
2. Copy structure from existing guide
3. Add link to `guides/index.html`

### New Data Source
1. Create `scripts/data-brain/sources/{name}.js`
2. Export `{ name, fetch() }` interface
3. Register in `scripts/data-brain/index.js`

## Constraints

- **Free hosting only** - GitHub Pages
- **No backend** - Static files only
- **No paid APIs** - Free tiers only
- **Vanilla JS** - No frameworks
- **Mobile-first** - 90% phone users
