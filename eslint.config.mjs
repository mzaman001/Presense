import { defineConfig, globalIgnores } from "eslint/config";
import { fixupConfigRules } from "@eslint/compat";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-plugin-react (inside eslint-config-next, latest 7.37.5) still calls
// context APIs that ESLint 10 removed (context.getFilename and others), and
// fails to load. fixupConfigRules is ESLint's own shim for that: it restores
// the old methods for those plugins only. Remove it once eslint-config-next
// ships a react plugin that supports ESLint 10.
const eslintConfig = defineConfig([
  ...fixupConfigRules(nextVitals),
  ...fixupConfigRules(nextTs),
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // CommonJS Node scripts (run directly, no bundler) — require() is correct here.
    files: ["scripts/**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
