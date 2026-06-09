const fs = require('fs');
const path = require('path');

const uiScenePath = path.join(__dirname, '..', 'src', 'game', 'scenes', 'UIScene.ts');
const content = fs.readFileSync(uiScenePath, 'utf8');
const lines = content.split('\n');

for (let i = 1680; i <= 1700; i++) {
  if (lines[i] !== undefined) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
