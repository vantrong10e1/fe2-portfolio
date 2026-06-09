const fs = require('fs');
const path = require('path');

const scenePath = path.join(__dirname, '..', 'src', 'game', 'scenes', 'GameScene.ts');
const content = fs.readFileSync(scenePath, 'utf8');
const lines = content.split('\n');

const idx = lines.findIndex(l => l.includes('spawnCraftingTable('));
if (idx !== -1) {
  console.log(`Found spawnCraftingTable at line ${idx + 1}`);
  for (let i = 0; i < 30; i++) {
    console.log(`${idx + 1 + i}: ${lines[idx + i]}`);
  }
} else {
  console.log('Not found');
}
