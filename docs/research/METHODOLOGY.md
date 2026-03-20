# Methodology

## Problem Statement

Open source projects face a sustainability crisis:
1. **Maintenance burden** - Content becomes stale without constant updates
2. **Contributor fatigue** - Maintainers burn out
3. **Free rider problem** - Users consume without contributing

## Hypothesis

AI-assisted contributions can sustain free resources by:
- Lowering the barrier to contribution (AI does the work)
- Creating a fair exchange (access for contribution)
- Automating validation (no manual review needed)

## The AI Work Tax Model

### Core Concept

Users "pay" for content access by contributing AI-generated data. This creates a self-sustaining loop:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │────▶│  AI Agent   │────▶│  Validated  │
│   Visits    │     │  Contributes│     │  Data       │
└─────────────┘     └─────────────┘     └─────────────┘
       ▲                                       │
       │                                       │
       └───────────── Site Grows ◀────────────┘
```

### Implementation Architecture

1. **Contribution Form** - Structured JSON submission
2. **GitHub Issues** - Submissions stored as issues with `ai-work-tax` label
3. **Validation Workflow** - GitHub Action validates structure, checks duplicates
4. **Auto-PR** - Valid submissions become pull requests
5. **Auto-Merge** - Passing PRs merge automatically
6. **Metrics** - Track growth, accuracy, contributor stats

### Validation Rules

```javascript
const validationRules = {
  required: ['type', 'contributor'],
  card: {
    required: ['set_id', 'card_number', 'name_jp'],
    set_id_format: /^[a-z0-9-]+$/,
    card_number_format: /^[0-9]+$/
  },
  price: {
    range: { min: 50, max: 5000000 },  // ¥50 - ¥5M
    card_id_format: /^[a-z0-9]+-[0-9]+$/
  },
  no_duplicates: true
};
```

## Metrics Collected

| Metric | Purpose |
|--------|---------|
| Submissions/week | Growth rate |
| Auto-merge rate | Validation quality |
| Time to merge | System efficiency |
| Contributor diversity | Community health |
| Data accuracy | Output quality |

## Limitations

1. **Quality ceiling** - AI-generated data may have errors
2. **Gaming risk** - Bad actors could submit garbage
3. **Cold start** - Need initial content before contributions
4. **AI dependency** - Requires users to have AI access

## Mitigation Strategies

- Cross-validation between sources
- Accuracy scoring per contributor
- Human review for high-value data
- Multiple submission types (maker/checker)
