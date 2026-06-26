---
version: 1.0.0
name: Japan TCG Price Guide
description: Lightweight, fast, content-first static site for Japanese trading-card price data (Pokémon + One Piece). Light gray canvas, system fonts, brand-red accent with per-franchise color coding. No build step, no CSS framework — plain HTML + shared CSS (base.css, components/header.css).
colors:
  # Brand
  primary: "#EE1515"            # Pokémon red — links, accents, primary headings
  onepiece: "#FFD700"           # One Piece gold — franchise accent
  jp: "#9370DB"                 # medium purple — Japanese-text annotations
  # Surfaces
  background: "#F5F5F5"         # light gray canvas
  surface: "#FFFFFF"            # cards, stats, header
  text: "#222222"               # primary text
  text-muted: "#666666"         # secondary text (subtitles, footer, labels)
  border: "#DDDDDD"             # hairline borders
  border-light: "#E0E0E0"       # header / lighter dividers
  focus: "#4A90D9"              # focus-visible outline (blue, distinct from red)
  # Semantic — price + tag system
  price: "#228B22"              # forest green — prices (always bold)
  tag-buy-bg: "#D4EDDA"
  tag-buy-text: "#155724"       # green — "buy" tag
  tag-flip-bg: "#FFF3CD"
  tag-flip-text: "#856404"      # amber — "flip" tag
  tag-grail-bg: "#F8D7DA"
  tag-grail-text: "#721C24"     # red — "grail" tag
typography:
  body-md:
    fontFamily: -apple-system, BlinkMacSystemFont, Segoe UI, Hiragino Sans, sans-serif
    fontSize: 1rem
    lineHeight: 1.5
  card-title:
    fontFamily: -apple-system, BlinkMacSystemFont, Segoe UI, Hiragino Sans, sans-serif
    fontSize: 1.3em
    fontWeight: 700
  small:
    fontFamily: -apple-system, BlinkMacSystemFont, Segoe UI, Hiragino Sans, sans-serif
    fontSize: 0.85em
rounded:
  sm: 4px                       # tags, set-h2 bands
  md: 6px                       # stat tiles, logo
  lg: 8px                       # hero images
spacing:
  xs: 5px
  sm: 8px
  md: 10px
  lg: 15px
  xl: 20px
components:
  tag:
    backgroundColor: "{colors.tag-buy-bg}"
    textColor: "{colors.tag-buy-text}"
    rounded: "{rounded.sm}"
    padding: 2px 8px
  stat:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: 10px
  set-heading:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: 8px 12px
---

## Overview

Japan TCG Price Guide is a **content-first, no-build static site** serving
Japanese trading-card price data. Speed and clarity win over polish — plain
HTML, two shared stylesheets (`base.css`, `components/header.css`), hardcoded
hex (no CSS variables, no framework). The look is clean and utilitarian: a
light gray page, white content cards, and brand-red accents.

Edit the shared CSS, not per-page styles — `base.css` components (`.hero`,
`.stat`, `.tag`, `.set-h2`, footer) are used across 12+ pages.

## Colors

`background` (#F5F5F5) is the page; `surface` white for cards/stats/header.
Text is `text` (#222) primary, `text-muted` (#666) secondary.

`primary` (Pokémon red #EE1515) is the accent — links, stat values, the
`set-h2` band, and the left-border on Pokémon cards. `onepiece` gold (#FFD700)
left-borders One Piece cards — the two franchises are color-coded by their card
border, not separate layouts. `jp` purple marks Japanese-text annotations.

**Known contrast findings (all marginal, all on white `surface`).** Several
accent colors sit just under WCAG AA's 4.5:1 for *normal* text, but each is
used large and/or bold in practice, clearing AA's large-text threshold (3:1),
so none is a hard blocker. Verified ratios:
- white on `primary` red `#EE1515` (the `set-h2` band): **4.42:1**
- `primary` red on white (`stat` values, bold): **4.42:1**
- `price` green `#228B22` on white (bold): **4.39:1**
- `jp` purple `#9370DB` on white (used at 1.3em title size): **3.76:1**

If ever addressed, darken the foreground color slightly (e.g. price → a deeper
green) rather than changing the white/surface; don't use any of these for small
body-size text.

**Semantic price/tag system** (don't repurpose these as decoration):
- `price` — forest green, always bold, for any price figure.
- `tag-buy` (green) / `tag-flip` (amber) / `tag-grail` (red) — the three
  recommendation tags, each a bg+text pair tuned for contrast on its fill.

## Typography

**System font stack** (`-apple-system` … `Hiragino Sans`) everywhere — no web
fonts, for speed, and `Hiragino Sans` so Japanese card names render natively.
Body is 1rem at 1.5 line-height. Card titles are 1.3em/700 (use `.card-title`,
a block element, rather than an `<h2>` inside a link — that was an a11y fix).

## Layout

Centered single column, `max-width: 900px` (1200px for the fixed header),
mobile-first. Body has `overflow-x: hidden` and a fixed 56px header offset.
Use the `spacing` scale and the shared `.container` / `.hero` / `.stats`
helpers rather than ad-hoc inline spacing. There are dedicated print styles —
preserve them when editing list/grid pages.

## Elevation & Depth

Minimal and flat. The only shadows are the header (`0 1px 3px rgba(0,0,0,0.08)`)
and implicit card separation via white `surface` + `border` hairlines. Don't
add heavy shadows — this is a fast, flat utility site.

## Shapes

Modest rounding: `sm` (4px) for tags and the `set-h2` band, `md` (6px) for stat
tiles and the logo, `lg` (8px) for hero card images (which also get a 2px #222
border). No pills or fully-rounded shapes.

## Components

- **tag** — small pill (`sm` radius, 2px 8px padding). Three variants by
  recommendation: `tag-buy` / `tag-flip` / `tag-grail`, each a bg+text pair.
- **stat** — white tile, `md` radius, `border`, centered; label in `text-muted`
  small, value in `primary` red bold.
- **set-heading** (`.set-h2`) — red `primary` band, white text, `sm` radius;
  the section header used across set pages.
- **card row** — left-border color codes franchise: `primary` red (Pokémon),
  `onepiece` gold (One Piece).

## Do's and Don'ts

- **Do** edit the shared CSS (`base.css`, `header.css`) so changes propagate
  across all 12+ pages — don't fork styles per page.
- **Do** keep prices in `price` green + bold, and use the three tag variants
  as defined; they're a recognised semantic system.
- **Do** keep the system font stack — it includes `Hiragino Sans` for Japanese.
- **Do** preserve the `focus` (#4A90D9) `:focus-visible` outlines and the skip
  link (accessibility fixes #148/#149).
- **Don't** introduce a CSS framework, web fonts, or a build step — the site's
  value is being fast and dependency-free.
- **Don't** add heavy shadows or large rounding; keep it flat and utilitarian.
- **Don't** color-code franchises with anything other than the card left-border.
