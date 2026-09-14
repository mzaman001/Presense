import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/lib/__tests__/setup.ts"],
    testTimeout: 15000,
    // .worktrees/**: git worktrees created for isolated branch work live
    // as real subdirectories under the repo root, each with their own
    // node_modules and copies of every test file. Without excluding them,
    // Vitest's recursive discovery double-runs (or triple-runs) the whole
    // suite against stale/foreign node_modules the moment more than one
    // worktree exists on disk — a repeated, confusing false-failure
    // pattern in practice, not a hypothetical.
    exclude: [
      "**/node_modules/**",
      "**/tests/**",
      "**/e2e/**",
      "**/.worktrees/**",
      "**/.claude/worktrees/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: [
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
        "src/app/**/loading.tsx",
        "src/app/**/error.tsx",
        "src/app/layout.tsx",
        "src/app/icon.tsx",
        "src/app/sw.ts",
        "src/types/**",
        "src/lib/__tests__/**",
        "**/*.spec.*",
      ],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 40,
        statements: 50,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
