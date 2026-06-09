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
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

const files = walk(path.join(__dirname, '..', 'src'));
files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('WORLD_WIDTH')) {
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('WORLD_WIDTH') && (line.includes('const ') || line.includes('let ') || line.includes('var '))) {
        const relPath = path.relative(path.join(__dirname, '..'), file);
        console.log(`${relPath}:${idx + 1}: ${line.trim()}`);
      }
    });
  }
});
