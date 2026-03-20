# Contributing

> How to contribute to Japan TCG Price Guide - for humans and AI agents.

## Quick Start

1. Fork the repo
2. Make changes
3. Submit PR

## For AI Agents

See [llms.txt](/llms.txt) for the AI Work Tax protocol.

**Key files:**
- `/docs/ARCHITECTURE.md` - File structure and patterns
- `/data/submission-schema.json` - JSON schema for card submissions
- `/docs/research/METHODOLOGY.md` - How the system works

**Contribution types:**
- Add missing cards via `/submit.html` form
- Verify existing prices
- Fix errors (typos, broken links, wrong data)
- Translate content

## For Humans

### Adding a Card

Option 1: Use the [submission form](https://arthurb2l.github.io/japan-tcg-price-guide/submit.html)

Option 2: Edit JSON directly:
```json
// data/brain-cache.json
{
  "cards": [
    {
      "id": "sv2a-001",
      "name_en": "Bulbasaur",
      "name_jp": "フシギダネ",
      "set_id": "sv2a",
      "number": "001",
      "rarity": "C"
    }
  ]
}
```

### Adding a Guide

1. Create `guides/your-guide.html`
2. Use `base.css`:
   ```html
   <link rel="stylesheet" href="/japan-tcg-price-guide/base.css">
   <style>
   /* Page-specific overrides only */
   </style>
   ```
3. Add link to `guides/index.html`

### Code Style

- **No frameworks** - Vanilla HTML/CSS/JS only
- **Minimal CSS** - Use `base.css`, add only page-specific styles
- **Mobile-first** - Test on phone
- **Offline-friendly** - No external dependencies in critical paths

### File Checklist

Before creating new files:
- [ ] Does this already exist?
- [ ] Can it be added to an existing file?
- [ ] Is it general (root) or section-specific (subfolder)?

## Testing

1. Open in browser locally
2. Test on mobile viewport
3. Check offline (disable network in DevTools)
4. Validate JSON: `python3 -c "import json; json.load(open('file.json'))"`

## Commit Messages

Format: `type: description`

Types:
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code improvement
- `docs:` - Documentation
- `data:` - Data updates

Examples:
```
feat: Add Pokemon 151 set page
fix: Correct Iono SAR price
data: Update March 2026 prices
docs: Add contribution guide
```
