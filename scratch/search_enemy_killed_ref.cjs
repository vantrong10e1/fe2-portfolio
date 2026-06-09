const fs = require('fs');
const path = require('path');

const scenePath = path.join(__dirname, '..', 'src', 'game', 'scenes', 'GameScene.ts');
const content = fs.readFileSync(scenePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('onEnemyKilled') || line.includes('ENEMY_KILLED')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
