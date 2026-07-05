const fs = require('fs');
const glob = require('glob'); // wait, glob might not be installed. I'll use recursive readdir
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

walk('src', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('import { Icon } from "@/components/ui/Icon"')) {
      content = content.replace('import { Icon } from "@/components/ui/Icon"', 'import { Icon as UiIcon } from "@/components/ui/Icon"');
      fs.writeFileSync(filePath, content);
      console.log('Fixed', filePath);
    }
  }
});
