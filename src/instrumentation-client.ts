// Client-side Sentry init - loaded automatically by Next.js as client instrumentation.
// The browser SDK auto-captures window errors and unhandled promise rejections, which is
// the same class of events the old manual listeners reported via /api/telemetry.
// DSN-gated: without NEXT_PUBLIC_SENTRY_DSN this is a safe no-op (AGENTS.md invariant 1).
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
