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
  if (content.includes('addItem') || content.includes('inventorySystem')) {
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('addItem') || line.includes('inventorySystem')) {
        const relPath = path.relative(path.join(__dirname, '..'), file);
        if (line.includes('class ') || line.includes('interface ') || line.includes('function ') || line.includes('public ') || line.includes('private ') || line.includes(' = ')) {
          console.log(`${relPath}:${idx + 1}: ${line.trim()}`);
        }
      }
    });
  }
});
