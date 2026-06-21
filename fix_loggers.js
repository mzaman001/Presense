const fs = require('fs');

const files = [
  "src/app/(app)/remember/people/page.tsx",
  "src/app/(app)/think/[id]/page.tsx",
  "src/app/api/capture/route.ts",
  "src/app/onboarding/OnboardingWizard.tsx",
  "src/components/features/AddPersonPanel.tsx",
  "src/components/features/CaptureModal.tsx",
  "src/components/features/LocationAddPanel.tsx",
  "src/components/features/TaskAddPanel.tsx",
  "src/hooks/useRealtime.ts"
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  if (content.includes('console.log(')) {
    content = content.replace(/console\.log\(/g, 'logger.info(');
    changed = true;
  }
  if (content.includes('console.error(')) {
    content = content.replace(/console\.error\(/g, 'logger.error(');
    changed = true;
  }
  
  if (changed) {
    if (!content.includes('import { logger }')) {
      const importStmt = 'import { logger } from "@/lib/logger";\n';
      if (content.startsWith('"use client"') || content.startsWith("'use client'")) {
        content = content.replace(/^(["']use client["'];?)\r?\n/, "$1\n" + importStmt);
      } else {
        content = importStmt + content;
      }
    }
    fs.writeFileSync(file, content);
  }
}
