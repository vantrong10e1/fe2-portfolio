const fs = require('fs');
const path = require('path');

const uiScenePath = path.join(__dirname, '..', 'src', 'game', 'scenes', 'UIScene.ts');
const content = fs.readFileSync(uiScenePath, 'utf8');
const lines = content.split('\n');

const idx = lines.findIndex(l => l.includes('private createInventoryPanel('));
if (idx !== -1) {
  console.log(`Found createInventoryPanel at line ${idx + 1}`);
  for (let i = 0; i < 120; i++) {
    console.log(`${idx + 1 + i}: ${lines[idx + i]}`);
  }
} else {
  console.log('Not found');
}
