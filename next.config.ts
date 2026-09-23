import type { NextConfig } from "next";
import { spawnSync } from "node:child_process";
import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";

const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout ??
  crypto.randomUUID();

const withSerwist = withSerwistInit({
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
});

const sentryRelease =
  process.env.SENTRY_RELEASE ||
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
  "development";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  devIndicators: {
    position: "top-right",
  },
  experimental: {
    // Turbopack's on-disk caches are on by default in Next 16.3 and reused a
    // stale compile of globals.css: production (Vercel restores .next/cache
    // into each build) shipped new components with the previous stylesheet,
    // and `next dev` kept serving old CSS across restarts until
    // .next/dev/cache was deleted. Correct CSS matters more than warm starts.
    turbopackFileSystemCacheForBuild: false,
    turbopackFileSystemCacheForDev: false,
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "date-fns",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "compromise",
      "@base-ui/react",
    ],
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  compiler: {
    removeConsole: { exclude: ["error"] },
  },
  turbopack: {},
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

import withBundleAnalyzer from "@next/bundle-analyzer";

const analyze = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

export default withSentryConfig(analyze(withSerwist(nextConfig)), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: { name: sentryRelease },
  silent: !process.env.CI,
  // We use Sentry for error capture only, not performance tracing (see
  // instrumentation-client.ts — no tracesSampleRate/tracesSampler is set).
  // Without this, @sentry/nextjs bundles browserTracingIntegration into the
  // client build regardless, at ~115KB gzip.
  webpack: {
    treeshake: { removeTracing: true },
  },
});
