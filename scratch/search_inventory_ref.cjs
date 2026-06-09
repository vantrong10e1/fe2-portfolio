const fs = require('fs');
const path = require('path');

const uiScenePath = path.join(__dirname, '..', 'src', 'game', 'scenes', 'UIScene.ts');
const content = fs.readFileSync(uiScenePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('inventoryRef')) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
