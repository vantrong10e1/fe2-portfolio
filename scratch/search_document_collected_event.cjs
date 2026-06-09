const fs = require('fs');
const path = require('path');

const typesPath = path.join(__dirname, '..', 'src', 'types', 'game.types.ts');
if (fs.existsSync(typesPath)) {
  const content = fs.readFileSync(typesPath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('DOCUMENT_COLLECTED')) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  });
} else {
  console.log('types file not found');
}
