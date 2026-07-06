const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src/components');

files.forEach(file => {
  if (file.includes('Icon.tsx')) return;
  
  let content = fs.readFileSync(file, 'utf8');
  const originalContent = content;
  
  // Find the lucide-react import
  const lucideMatch = content.match(/import\s+{([^}]+)}\s+from\s+['"]lucide-react['"]/);
  if (!lucideMatch) return;
  
  const icons = lucideMatch[1].split(',').map(s => s.replace(/[\r\n\s]+/g, '').trim()).filter(Boolean);
  
  // Add Icon import if not present
  if (!content.includes('import { Icon }') && !content.includes('import { Icon as')) {
    // Find where to insert: right after the lucide import is easiest!
    content = content.replace(/import\s+{[^}]+}\s+from\s+['"]lucide-react['"];?/, match => {
      return match + '\nimport { Icon } from "@/components/ui/Icon";';
    });
  }
  
  let newContent = content;
  icons.forEach(icon => {
    if (icon.includes('as')) {
      icon = icon.split('as')[1].trim();
    }
    
    // Replace <IconName ... /> with <Icon icon={IconName} ... />
    // Also replace </IconName> with </Icon> if they exist (rare for lucide)
    const regex = new RegExp(`<${icon}([\\s>])`, 'g');
    newContent = newContent.replace(regex, `<Icon icon={${icon}}$1`);
  });
  
  if (newContent !== originalContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log('Modified', file);
  }
});
