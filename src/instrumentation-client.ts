// Client-side Sentry - loaded automatically by Next.js as client instrumentation.
// The browser SDK auto-captures window errors and unhandled promise rejections, which is
// the same class of events the old manual listeners reported via /api/telemetry.
// DSN-gated: without NEXT_PUBLIC_SENTRY_DSN this is a safe no-op (AGENTS.md invariant 1).
//
// This file runs before hydration on every route, /login included, so it must
// not import @sentry/nextjs statically: that shipped ~36 KiB gz of SDK in
// /login's initial JS (PERF-09). The SDK is loaded from src/lib/sentry-client.ts
// once the page has finished loading and the main thread is idle; errors thrown
// before then are buffered and replayed. See that file for the trade-off.
//
// No tracesSampleRate/tracesSampler here on purpose: this app wants error capture,
// not performance tracing. The tracing code itself is stripped from the client
// bundle via webpack.treeshake.removeTracing in next.config.ts — setting either
// option here wouldn't do that on its own, since bundling is a build-time decision
// and Sentry.init()'s config is read at runtime.
import { bufferEarlyErrors, loadSentry } from "@/lib/sentry-client";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  bufferEarlyErrors();

  const loadWhenIdle = () => {
    if ("requestIdleCallback" in window) {
      requestIdleCallback(() => void loadSentry(), { timeout: 3000 });
    } else {
      setTimeout(() => void loadSentry(), 1);
    }
  };

  if (document.readyState === "complete") loadWhenIdle();
  else window.addEventListener("load", loadWhenIdle, { once: true });
}

export { onRouterTransitionStart } from "@/lib/sentry-client";
