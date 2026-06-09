const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        results = results.concat(walk(fullPath));
      }
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

const files = walk(path.join(__dirname, '..', 'src'));
console.log(`Found ${files.length} source files.`);

const searchTerms = ['CHEST_OPENED', 'chest-opened', 'show-tutorial', 'tutorial-active', 'boss-slain', 'BOSS_DEFEATED', 'bossDefeated', 'chestId', 'pauseGame', 'GAME_PAUSED'];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  searchTerms.forEach(term => {
    if (content.includes(term)) {
      // Find matching lines
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes(term)) {
          const relPath = path.relative(path.join(__dirname, '..'), file);
          console.log(`[${term}] in ${relPath}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
  });
});
