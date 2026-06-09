const fs = require('fs');
const path = require('path');

const scenePath = path.join(__dirname, '..', 'src', 'game', 'scenes', 'GameScene.ts');
const content = fs.readFileSync(scenePath, 'utf8');
const lines = content.split('\n');

const idx = lines.findIndex(l => l.includes('handleEnemyDeath') || l.includes('onEnemyDeath') || l.includes('enemyDeath'));
if (idx !== -1) {
  console.log(`Found handleEnemyDeath at line ${idx + 1}`);
  for (let i = -5; i < 35; i++) {
    if (lines[idx + i] !== undefined) {
      console.log(`${idx + 1 + i}: ${lines[idx + i]}`);
    }
  }
} else {
  console.log('Not found');
}
