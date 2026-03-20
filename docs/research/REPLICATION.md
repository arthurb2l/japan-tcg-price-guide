# Replication Guide

Implement AI Work Tax in your own project in ~4 hours.

## Prerequisites

- GitHub repository
- GitHub Actions enabled
- Static site (GitHub Pages, Netlify, etc.)

## Step 1: Submission Form (30 min)

Create a form that outputs structured JSON:

```html
<!-- submit.html -->
<form id="form">
  <input type="text" id="title" required>
  <textarea id="content" required></textarea>
  <input type="text" id="contributor" required>
  <button type="submit">Submit</button>
</form>

<script>
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = {
    type: 'content',
    title: document.getElementById('title').value,
    content: document.getElementById('content').value,
    contributor: document.getElementById('contributor').value
  };
  
  // Open GitHub issue with JSON
  const title = `[AI-TAX] ${data.title}`;
  const body = '```json\n' + JSON.stringify(data, null, 2) + '\n```';
  const url = `https://github.com/YOUR/REPO/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=ai-work-tax`;
  window.open(url, '_blank');
});
</script>
```

## Step 2: Validation Workflow (1 hour)

Create `.github/workflows/ai-work-tax-validator.yml`:

```yaml
name: AI Work Tax Validator

on:
  issues:
    types: [opened, edited]

jobs:
  validate:
    if: contains(github.event.issue.labels.*.name, 'ai-work-tax')
    runs-on: ubuntu-latest
    permissions:
      issues: write
      contents: write
      pull-requests: write
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Validate Submission
        id: validate
        uses: actions/github-script@v7
        with:
          script: |
            const body = context.payload.issue.body || '';
            const match = body.match(/```json\n([\s\S]*?)\n```/);
            
            if (!match) {
              core.setOutput('valid', false);
              core.setOutput('error', 'No JSON found');
              return;
            }
            
            try {
              const data = JSON.parse(match[1]);
              // Add your validation rules here
              if (!data.title || !data.content) {
                core.setOutput('valid', false);
                core.setOutput('error', 'Missing required fields');
                return;
              }
              core.setOutput('valid', true);
              core.setOutput('data', JSON.stringify(data));
            } catch (e) {
              core.setOutput('valid', false);
              core.setOutput('error', e.message);
            }
      
      - name: Comment Result
        uses: actions/github-script@v7
        with:
          script: |
            const valid = '${{ steps.validate.outputs.valid }}' === 'true';
            const comment = valid 
              ? '✅ Validation passed! Creating PR...'
              : '❌ Validation failed: ${{ steps.validate.outputs.error }}';
            
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: comment
            });
```

## Step 3: Auto-PR Creation (1 hour)

Add to the workflow after validation:

```yaml
      - name: Create PR
        if: steps.validate.outputs.valid == 'true'
        uses: actions/github-script@v7
        with:
          script: |
            const data = JSON.parse('${{ steps.validate.outputs.data }}');
            const fs = require('fs');
            const { execSync } = require('child_process');
            
            // Add to your data file
            let content = JSON.parse(fs.readFileSync('data/content.json', 'utf8'));
            content.items.push(data);
            fs.writeFileSync('data/content.json', JSON.stringify(content, null, 2));
            
            // Create branch and PR
            const branch = `ai-tax-${context.issue.number}`;
            execSync(`git config user.name "github-actions[bot]"`);
            execSync(`git config user.email "github-actions[bot]@users.noreply.github.com"`);
            execSync(`git checkout -b ${branch}`);
            execSync(`git add data/content.json`);
            execSync(`git commit -m "Add contribution from #${context.issue.number}"`);
            execSync(`git push origin ${branch}`);
            
            await github.rest.pulls.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `[AI-TAX] ${data.title}`,
              head: branch,
              base: 'main',
              body: `Closes #${context.issue.number}`
            });
```

## Step 4: Metrics Collection (30 min)

Create `scripts/calculate-metrics.js`:

```javascript
const fs = require('fs');

const content = JSON.parse(fs.readFileSync('data/content.json', 'utf8'));
const metrics = {
  generated: new Date().toISOString(),
  totalItems: content.items.length,
  byContributor: {}
};

content.items.forEach(item => {
  metrics.byContributor[item.contributor] = 
    (metrics.byContributor[item.contributor] || 0) + 1;
});

console.log(JSON.stringify(metrics, null, 2));
```

## Customization

### Different Content Types

Modify validation rules for your domain:

```javascript
// Recipe site
const rules = {
  required: ['title', 'ingredients', 'steps'],
  ingredients: { minLength: 1 },
  steps: { minLength: 1 }
};

// Documentation site
const rules = {
  required: ['topic', 'content', 'category'],
  category: { enum: ['tutorial', 'reference', 'guide'] }
};
```

### Contribution Incentives

- Show contributor leaderboard
- Badge system for top contributors
- Early access to new features

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Workflow not triggering | Check label matches exactly |
| PR creation fails | Verify permissions in workflow |
| Duplicate submissions | Add duplicate check in validation |
