// Client-side Sentry init - loaded automatically by Next.js as client instrumentation.
// The browser SDK auto-captures window errors and unhandled promise rejections, which is
// the same class of events the old manual listeners reported via /api/telemetry.
// DSN-gated: without NEXT_PUBLIC_SENTRY_DSN this is a safe no-op (AGENTS.md invariant 1).
//
// No tracesSampleRate/tracesSampler here on purpose: this app wants error capture,
// not performance tracing. The tracing code itself is stripped from the client
// bundle via webpack.treeshake.removeTracing in next.config.ts — setting either
// option here wouldn't do that on its own, since bundling is a build-time decision
// and Sentry.init()'s config is read at runtime.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
