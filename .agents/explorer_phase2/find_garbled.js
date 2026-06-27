const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../src');

const garbledPatterns = [
  'â†’', // →
  'Â·',  // ·
  'â—¾', // ▪
  'â†»', // ⇆
  'Ã—',  // ×
  'â–¾', // ▼
  'â†',  // partial arrow
  'â—',  // partial bullet/square
  'â–',  // partial down block
  'Ã',   // partial cross or other latin capital A with tilde
  'Â'    // partial latin capital A with circumflex
];

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.css') || file.endsWith('.js') || file.endsWith('.jsx'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        const found = [];
        garbledPatterns.forEach(pattern => {
          if (line.includes(pattern)) {
            found.push(pattern);
          }
        });
        if (found.length > 0) {
          console.log(`${fullPath}:${index + 1}: [${found.join(', ')}] => ${line.trim()}`);
        }
      });
    }
  }
}

scanDir(rootDir);
