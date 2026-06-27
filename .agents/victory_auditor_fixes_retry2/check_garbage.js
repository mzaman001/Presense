const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== '.next' && f !== '.git') {
        walkDir(dirPath, callback);
      }
    } else {
      callback(dirPath);
    }
  });
}

const badPatterns = [
  'â†’', 'ðŸ“Œ', 'Ã—', 'â–¾', 'â€”', 'â€¢', 'â†»', 'Â·', 'â—¾', 'â€', 'Ã', 'ðŸ'
];

let foundCount = 0;

walkDir(path.join(__dirname, '..', '..', 'src'), (filePath) => {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  const content = fs.readFileSync(filePath, 'utf8');
  badPatterns.forEach(pattern => {
    if (content.includes(pattern)) {
      console.log(`FOUND BAD PATTERN [${pattern}] in file: ${filePath}`);
      foundCount++;
    }
  });
});

console.log(`Scan completed. Found ${foundCount} occurrences.`);
process.exit(foundCount > 0 ? 1 : 0);
