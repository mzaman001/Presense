const fs = require('fs');

let content = fs.readFileSync('src/components/features/AddPersonPanel.tsx', 'utf8');

const lucideMatch = content.match(/import\s+{([^}]+)}\s+from\s+['"]lucide-react['"]/);
console.log("lucideMatch", !!lucideMatch);
if (lucideMatch) {
  console.log("icons", lucideMatch[1].split(',').map(s => s.trim()).filter(Boolean));
}

let modified = content.replace(/import\s+{[^}]+}\s+from\s+['"]lucide-react['"];?/, match => {
  return match + '\nimport { Icon } from "@/components/ui/Icon";';
});

console.log("Did replace work?", modified !== content);
