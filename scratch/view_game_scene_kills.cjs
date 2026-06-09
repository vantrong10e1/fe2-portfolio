const fs = require('fs');
const path = require('path');

const scenePath = path.join(__dirname, '..', 'src', 'game', 'scenes', 'GameScene.ts');
const content = fs.readFileSync(scenePath, 'utf8');
const lines = content.split('\n');

for (let i = 594; i <= 614; i++) {
  if (lines[i] !== undefined) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
