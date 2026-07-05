import { Project, SyntaxKind, JsxOpeningElement, JsxSelfClosingElement } from "ts-morph";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const sourceFiles = project.getSourceFiles("src/**/*.{ts,tsx}");

for (const sourceFile of sourceFiles) {
  const imports = sourceFile.getImportDeclarations();
  const lucideImport = imports.find(i => i.getModuleSpecifierValue() === "lucide-react");
  
  if (!lucideImport) continue;

  const namedImports = lucideImport.getNamedImports();
  const iconNames = new Set(namedImports.map(ni => ni.getNameNode().getText())); // Local aliases or names
  // wait, alias is .getAliasNode()?.getText() || .getNameNode().getText()
  const localIconNames = new Set(namedImports.map(ni => ni.getAliasNode()?.getText() || ni.getNameNode().getText()));

  let hasReplacements = false;

  const jsxElements = sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement);
  for (const jsxElement of jsxElements) {
    const tagNameNode = jsxElement.getTagNameNode();
    const tagName = tagNameNode.getText();
    if (localIconNames.has(tagName)) {
      tagNameNode.replaceWithText("UiIcon");
      jsxElement.addAttribute({ name: "icon", initializer: `{${tagName}}` });
      hasReplacements = true;
    }
  }

  const jsxOpeningElements = sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement);
  for (const jsxOpening of jsxOpeningElements) {
    const tagNameNode = jsxOpening.getTagNameNode();
    const tagName = tagNameNode.getText();
    if (localIconNames.has(tagName)) {
      tagNameNode.replaceWithText("UiIcon");
      jsxOpening.addAttribute({ name: "icon", initializer: `{${tagName}}` });
      
      const parent = jsxOpening.getParentIfKind(SyntaxKind.JsxElement);
      if (parent) {
        const closing = parent.getClosingElement();
        closing.getTagNameNode().replaceWithText("UiIcon");
      }
      hasReplacements = true;
    }
  }

  // Also check if they use dynamic variables as icons, like `<Icon className="w-4 h-4" />` where `Icon` is from props.
  // Wait, if they do that, it's not a lucide-react import, so it won't be in `localIconNames`.
  // BUT wait, if we add `<Icon icon={...} />`, we need to make sure we don't name collision with `import { Icon } from "@/components/ui/Icon"`.
  // If `localIconNames` includes "Icon", we need to handle it. Lucide doesn't have an icon named `Icon` directly usually (it's called something else), but let's check.
  
  if (hasReplacements) {
    // Check if Icon is already imported
    const iconImport = imports.find(i => i.getModuleSpecifierValue() === "@/components/ui/Icon" || i.getModuleSpecifierValue() === "../ui/Icon");
    if (!iconImport) {
      sourceFile.addImportDeclaration({
        namedImports: [{ name: "Icon", alias: "UiIcon" }],
        moduleSpecifier: "@/components/ui/Icon",
      });
    }
  }
}

project.saveSync();
console.log("Done!");
