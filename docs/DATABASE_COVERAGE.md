# Database Coverage Tracking

## Quick Stats
Run this to get current stats:
```bash
cd /mnt/c/q/Pokemon && cat data/brain-cache.json | jq '{
  total: [.sets[][]] | length,
  priced: [.sets[][] | select(.price.eur != null)] | length,
  sets: (.sets | keys | length),
  size_mb: (. | tostring | length / 1048576 | . * 100 | floor / 100)
}'
```

## Current Coverage (2026-03-21)
| Era | Sets in DB | Total Available | Status |
|-----|------------|-----------------|--------|
| Vintage (base/neo/gym) | 6 | ~15 | 🔄 Partial |
| XY | 4 | 12 | 🔄 Partial |
| Sun & Moon | 7 | 17 | 🔄 Partial |
| Sword & Shield | 4 | 13 | 🔄 Partial |
| Scarlet & Violet | 17 | 17 | ✅ Complete |

## TCGdex Set IDs Reference

### Vintage (~15 sets)
- base1, base2, base3, base4, base5 (Base, Jungle, Fossil, BS2, Team Rocket)
- neo1, neo2, neo3, neo4 (Genesis, Discovery, Revelation, Destiny)
- gym1, gym2 (Heroes, Challenge)
- si1 (Southern Islands)
- bp (Best of Game promos)

### XY Era (12 sets)
- xy1-xy12 (XY through Evolutions)
- xyp (XY Promos)

### Sun & Moon (17 sets)
- sm1-sm12 (Base through Cosmic Eclipse)
- sm3.5, sm7.5, sm11.5 (Special sets)
- sm115 (Hidden Fates)
- smp (SM Promos)

### Sword & Shield (13 sets)
- swsh1-swsh12 (Base through Silver Tempest)
- swsh12.5 (Crown Zenith)
- swsh3.5, swsh4.5 (Champion's Path, Shining Fates)
- swshp (SWSH Promos)

### Scarlet & Violet (17+ sets)
- sv01-sv10 (Base through Destined Rivals)
- sv03.5, sv04.5, sv06.5, sv08.5 (Special sets)
- sv10.5b, sv10.5w (Prismatic Evolutions)
- svp (SV Promos)

## Adding Sets
```bash
# Add single set
node scripts/expand-cache.js sv01 --detailed

# Add multiple sets
node scripts/expand-cache.js base1 base2 base3 --detailed

# Check available sets from TCGdex
curl -s "https://api.tcgdex.net/v2/en/sets" | jq -r '.[] | "\(.id): \(.name)"'
```

## File Size Thresholds
- ✅ <3MB: Optimal for mobile
- ⚠️ 3-5MB: Acceptable, monitor performance
- 🔴 >5MB: Implement sharding (#71)
