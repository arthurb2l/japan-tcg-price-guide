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

## 🔲 Still Needed

### Priority 1: Quick Wins
| Task | Why | Effort |
|------|-----|--------|
| Add `REFACTORING.md` to track changes | q-context pattern: document decisions | ✅ This file |
| Update `llms.txt` with ARCHITECTURE.md link | AI discoverability | 5 min |

### Priority 2: Code Quality (from panel)
| Task | Why | Effort |
|------|-----|--------|
| Extract shared `base.css` | ~30 lines duplicated 20+ times | 30 min |
| Create GA include pattern | 13 files have copy-pasted analytics | 20 min |
| Standardize navigation component | Manual copy-paste = inconsistency risk | 20 min |

### Priority 3: q-context Learnings to Apply
| Learning | Application |
|----------|-------------|
| **Live Over Local** | ✅ Already using GitHub API for issues |
| **Single Source of Truth** | Need: centralize CSS, GA, nav |
| **File Creation Checklist** | Add to CONTRIBUTING.md |
| **Session Learnings pattern** | Consider `docs/LEARNINGS.md` for this project |
| **POST-COMPACT PROTOCOL** | Add to ARCHITECTURE.md for AI context reload |

### Priority 4: Future Improvements
| Task | Why | Effort |
|------|-----|--------|
| Add `CONTRIBUTING.md` | Guide AI + human contributors | 30 min |
| Enhance `llms.txt` for autonomous work | Self-growing site vision | 1 hr |
| Add Leaflet map with store pins | User requested, deferred | 15 min |

## 📋 Anti-Patterns Identified (from q-context)

Checking against q-context anti-patterns:

| Anti-Pattern | Status in This Repo |
|--------------|---------------------|
| ❌ Local copies of live data | ✅ OK - using GitHub API |
| ❌ Project details in README | ✅ OK - README is overview, details in docs/ |
| ❌ Duplicate scripts | ⚠️ CSS duplicated in every HTML |
| ❌ Multiple sources of truth | ⚠️ GA code in 13 places |
| ❌ Complex workflows when simple exist | ✅ Fixed - merged health-check |

## 🎯 Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-20 | Skip CSS extraction for now | Bigger refactor, needs testing across all pages |
| 2026-03-20 | Keep inline styles pattern | No build step = no easy include system |
| 2026-03-20 | Merge not delete health-check | Valuable checks, just redundant workflow |
