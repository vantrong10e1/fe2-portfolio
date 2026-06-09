const fs = require('fs');
const path = require('path');

const uiScenePath = path.join(__dirname, '..', 'src', 'game', 'scenes', 'UIScene.ts');
const content = fs.readFileSync(uiScenePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('interface Achievement') || line.includes('type Achievement')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
    for (let i = 1; i <= 10; i++) {
      console.log(`${idx + 1 + i}: ${lines[idx + i]}`);
    }
  }
});
