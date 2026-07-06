const { Project, SyntaxKind } = require("ts-morph");

const project = new Project();
project.addSourceFilesAtPaths("src/components/**/*.tsx");
const sourceFiles = project.getSourceFiles();

let filesChanged = 0;

sourceFiles.forEach(sourceFile => {
  if (sourceFile.getBaseName() === "Icon.tsx") return;

  const importDecs = sourceFile.getImportDeclarations();
  const lucideImport = importDecs.find(d => d.getModuleSpecifierValue() === "lucide-react");
  
  if (!lucideImport) return;

  const namedImports = lucideImport.getNamedImports().map(ni => ({
    name: ni.getName(),
    alias: ni.getAliasNode() ? ni.getAliasNode().getText() : ni.getName()
  }));
  
  const iconNames = namedImports.map(ni => ni.alias);
  
  if (iconNames.length === 0) return;

  // Add the wrapper import
  let hasUiIcon = false;
  for (const dec of importDecs) {
    if (dec.getModuleSpecifierValue() === "@/components/ui/Icon") {
      hasUiIcon = true;
    }
  }

  let wrapperName = "UiIcon";
  if (!hasUiIcon) {
    sourceFile.addImportDeclaration({
      moduleSpecifier: "@/components/ui/Icon",
      namedImports: [{ name: "Icon", alias: "UiIcon" }]
    });
  }

  let changed = false;

  sourceFile.forEachDescendant(node => {
    if (node.getKind() === SyntaxKind.JsxSelfClosingElement) {
      const tagName = node.getTagNameNode().getText();
      if (iconNames.includes(tagName)) {
        node.getTagNameNode().replaceWithText(wrapperName);
        node.addAttribute({
          name: "icon",
          initializer: `{${tagName}}`
        });
        changed = true;
      }
    } else if (node.getKind() === SyntaxKind.JsxOpeningElement) {
      const tagName = node.getTagNameNode().getText();
      if (iconNames.includes(tagName)) {
        node.getTagNameNode().replaceWithText(wrapperName);
        node.addAttribute({
          name: "icon",
          initializer: `{${tagName}}`
        });
        const parent = node.getParent();
        if (parent.getKind() === SyntaxKind.JsxElement) {
          const closing = parent.getClosingElement();
          closing.getTagNameNode().replaceWithText(wrapperName);
        }
        changed = true;
      }
    }
  });

  if (changed) {
    sourceFile.saveSync();
    console.log("Transformed", sourceFile.getFilePath());
    filesChanged++;
  }
});

console.log("Total files changed:", filesChanged);
