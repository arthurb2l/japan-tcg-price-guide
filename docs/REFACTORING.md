# Refactoring Tracker

> Documenting changes made and still needed based on expert panel review + q-context learnings.

## ✅ Completed

| Change | Impact | Date |
|--------|--------|------|
| Delete `nav-prototype.html` | Remove dead code | 2026-03-20 |
| Rename dead adapters to `.disabled.js` | Clarity on what's active | 2026-03-20 |
| Merge `health-check.yml` → `self-healing.yml` | -1 workflow, -67 LOC | 2026-03-20 |
| Create `docs/ARCHITECTURE.md` | AI/human reference | 2026-03-20 |
| Fix map section (remove empty iframe) | Usable store links | 2026-03-20 |
| Create `docs/REFACTORING.md` | Track changes | 2026-03-20 |
| Update `llms.txt` with architecture links | AI discoverability | 2026-03-20 |
| Create `base.css` + rollout to 9 pages | CSS extraction (~50 LOC saved) | 2026-03-20 |
| Create `CONTRIBUTING.md` | Human + AI contribution guide | 2026-03-20 |

## 🔲 Still Needed

### Priority 1: Code Quality
| Task | Why | Effort |
|------|-----|--------|
| GA include pattern | 13 files have copy-pasted analytics | 20 min |
| Extend base.css to remaining pages | calendar, tools, pokemon/sets | 30 min |

### Priority 2: Features
| Task | Why | Effort |
|------|-----|--------|
| ~~Leaflet map with store pins~~ | ✅ Done | - |

### Priority 3: Documentation
| Task | Why | Effort |
|------|-----|--------|
| Enhance `llms.txt` for autonomous work | Self-growing site vision | 1 hr |

## 📋 Anti-Patterns Status

| Anti-Pattern | Status |
|--------------|--------|
| ❌ Local copies of live data | ✅ OK - using GitHub API |
| ❌ Project details in README | ✅ OK - details in docs/ |
| ❌ Duplicate CSS | ✅ Fixed - base.css |
| ❌ Multiple sources of truth | ⚠️ GA code still in 13 places |

## 🎯 Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-20 | Keep dark theme pages separate | Different color scheme, not worth forcing |
| 2026-03-20 | Skip onepiece/index.html | Uses #D70000 vs #EE1515, page-specific components |
| 2026-03-20 | No build step for GA | Complexity vs benefit for 13 files |
