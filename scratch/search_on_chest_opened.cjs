const fs = require('fs');
const path = require('path');

const uiScenePath = path.join(__dirname, '..', 'src', 'game', 'scenes', 'UIScene.ts');
const content = fs.readFileSync(uiScenePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('onChestOpened')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
    // Print next 30 lines
    for (let i = 1; i <= 30; i++) {
      if (lines[idx + i] !== undefined) {
        console.log(`Line ${idx + 1 + i}: ${lines[idx + i]}`);
      }
    }
  }
});
