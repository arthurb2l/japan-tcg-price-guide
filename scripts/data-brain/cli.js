#!/usr/bin/env node
/**
 * Data Brain CLI - Test and manage the multi-source system
 * 
 * Usage:
 *   node cli.js health          - Check all source health
 *   node cli.js metrics         - Show current metrics
 *   node cli.js card <id>       - Fetch a card
 *   node cli.js sets [source]   - List sets from a source
 */

const brain = require('./index');
const tcgdex = require('./sources/tcgdex');

const [,, command, ...args] = process.argv;

async function main() {
  switch (command) {
    case 'health':
      console.log('Checking source health...\n');
      const health = await brain.healthCheck();
      for (const [id, data] of Object.entries(health)) {
        const icon = data.health === 'up' ? '✅' : '❌';
        console.log(`${icon} ${id}: ${data.health} (accuracy: ${(data.accuracyScore * 100).toFixed(0)}%)`);
      }
      break;
      
    case 'metrics':
      const metrics = brain.getMetrics();
      console.log(JSON.stringify(metrics, null, 2));
      break;
      
    case 'card':
      if (!args[0]) {
        console.log('Usage: node cli.js card <cardId>');
        process.exit(1);
      }
      console.log(`Fetching card: ${args[0]}\n`);
      const card = await brain.getCard(args[0], { includePrices: true });
      console.log(JSON.stringify(card, null, 2));
      break;
      
    case 'sets':
      const source = args[0] || 'tcgdex';
      console.log(`Fetching sets from ${source}...\n`);
      if (source === 'tcgdex') {
        const sets = await tcgdex.getSets({ language: 'en' });
        console.log(`Found ${sets.length} sets`);
        sets.slice(0, 10).forEach(s => console.log(`  ${s.id}: ${s.name}`));
        if (sets.length > 10) console.log(`  ... and ${sets.length - 10} more`);
      }
      break;
      
    default:
      console.log(`
Data Brain CLI

Commands:
  health          Check all source health
  metrics         Show current metrics  
  card <id>       Fetch a card by ID
  sets [source]   List sets (default: tcgdex)

Examples:
  node cli.js health
  node cli.js card base1-4
  node cli.js sets tcgdex
`);
  }
}

main().catch(console.error);
