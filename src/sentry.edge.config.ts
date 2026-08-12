// Edge-runtime Sentry init - auto-registered by withSentryConfig.
// DSN-gated: without NEXT_PUBLIC_SENTRY_DSN this is a safe no-op (AGENTS.md invariant 1).
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "development",
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  });
}
