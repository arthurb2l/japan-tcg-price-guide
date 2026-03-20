const fs = require('fs');

function calculateMetrics() {
  const metrics = {
    generated: new Date().toISOString(),
    content: {},
    health: {}
  };

  // Content metrics from brain-cache
  try {
    const cache = JSON.parse(fs.readFileSync('data/brain-cache.json', 'utf8'));
    const sets = Object.keys(cache.sets || {});
    let totalCards = 0;
    sets.forEach(s => totalCards += (cache.sets[s] || []).length);
    
    metrics.content = {
      totalCards,
      setsCount: sets.length,
      sets: sets,
      lastSync: cache.updated || null
    };
  } catch (e) {
    metrics.content = { error: 'brain-cache.json not found' };
  }

  // Contribution metrics
  try {
    const contrib = JSON.parse(fs.readFileSync('data/contributions.json', 'utf8'));
    metrics.contributions = {
      total: contrib.submissions?.length || 0,
      byType: {},
      byContributor: {}
    };
    
    (contrib.submissions || []).forEach(s => {
      metrics.contributions.byType[s.type] = (metrics.contributions.byType[s.type] || 0) + 1;
      metrics.contributions.byContributor[s.contributor] = (metrics.contributions.byContributor[s.contributor] || 0) + 1;
    });
  } catch (e) {
    metrics.contributions = { total: 0 };
  }

  // Source metrics
  try {
    const sourceMetrics = JSON.parse(fs.readFileSync('data/source-metrics.json', 'utf8'));
    metrics.sources = {};
    Object.keys(sourceMetrics).forEach(src => {
      metrics.sources[src] = {
        accuracy: sourceMetrics[src].accuracy,
        lastSuccess: sourceMetrics[src].lastSuccess,
        dailyUsage: sourceMetrics[src].dailyUsage
      };
    });
  } catch (e) {
    metrics.sources = {};
  }

  return metrics;
}

const metrics = calculateMetrics();
console.log(JSON.stringify(metrics, null, 2));
