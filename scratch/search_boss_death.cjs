const fs = require('fs');
const path = require('path');

const scenePath = path.join(__dirname, '..', 'src', 'game', 'scenes', 'GameScene.ts');
const content = fs.readFileSync(scenePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('bossDefeated = true') || line.includes('boss-death') || line.includes('boss-slain') || line.includes('defeat') || line.includes('killBoss') || line.includes('boss.ts')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
    for (let i = -10; i < 35; i++) {
      if (lines[idx + i] !== undefined) {
        console.log(`${idx + 1 + i}: ${lines[idx + i]}`);
      }
    }
  }
});
