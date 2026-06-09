const fs = require('fs');
const path = require('path');

const hudPath = path.join(__dirname, '..', 'src', 'components', 'ui', 'HUD.tsx');
const content = fs.readFileSync(hudPath, 'utf8');
const lines = content.split('\n');

const idx = lines.findIndex(l => l.includes('handleBossSlain') || l.includes('boss-slain'));
if (idx !== -1) {
  console.log(`Found handleBossSlain at line ${idx + 1}`);
  for (let i = -5; i < 35; i++) {
    if (lines[idx + i] !== undefined) {
      console.log(`${idx + 1 + i}: ${lines[idx + i]}`);
    }
  }
} else {
  console.log('Not found');
}
