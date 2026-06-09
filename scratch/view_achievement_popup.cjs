const fs = require('fs');
const path = require('path');

const uiScenePath = path.join(__dirname, '..', 'src', 'game', 'scenes', 'UIScene.ts');
const content = fs.readFileSync(uiScenePath, 'utf8');
const lines = content.split('\n');

const startIdx = lines.findIndex(l => l.includes('showAchievementPopup(ach: Achievement)'));
if (startIdx !== -1) {
  console.log(`Found showAchievementPopup at line ${startIdx + 1}`);
  for (let i = 0; i < 60; i++) {
    console.log(`${startIdx + 1 + i}: ${lines[startIdx + i]}`);
  }
} else {
  console.log('Not found');
}
