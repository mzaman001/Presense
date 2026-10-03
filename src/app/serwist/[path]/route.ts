import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

// Serves the service worker at /serwist/sw.js. @serwist/next only hooked into
// webpack, so once `next build` moved to Turbopack no worker was built or
// served at all. This route bundles src/app/sw.ts at build time instead.

const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout ??
  crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,
    additionalPrecacheEntries: [{ url: "/~offline", revision }],
    // Precache only what the offline page needs: stylesheets and icons.
    // Signed-in pages are never cached (see sw.ts), so precaching every JS
    // chunk would cost megabytes on first visit for nothing.
    globPatterns: [
      ".next/static/**/*.css",
      "public/**/*.{png,svg,ico,webmanifest}",
    ],
  });
