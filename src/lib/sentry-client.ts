// Lazy browser Sentry. Importing @sentry/nextjs statically from client code
// put ~36 KiB gz of SDK into /login's initial JS (PERF-09). Client code calls
// this module instead: the SDK is fetched as its own async chunk once the page
// has loaded and gone idle (see instrumentation-client.ts), or immediately when
// an error boundary reports something first.
//
// Trade-off: the SDK's global handlers are not installed until it loads. Until
// then bufferEarlyErrors() queues window errors and unhandled rejections and
// replays them after init, so they are reported late rather than lost. What is
// still lost: breadcrumbs from before the load, and errors on a page that is
// closed before the SDK chunk arrives.
//
// DSN-gated: without NEXT_PUBLIC_SENTRY_DSN every export is a no-op and the
// SDK chunk is never requested (AGENTS.md invariant 1).
type SentrySdk = typeof import("./sentry-sdk");
type CaptureArgs = Parameters<SentrySdk["captureException"]>;

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Bounds memory if the SDK chunk never loads (offline, blocked by an extension).
const MAX_QUEUED = 20;

let sdk: SentrySdk | null = null;
let loading: Promise<SentrySdk | null> | null = null;
const queue: CaptureArgs[] = [];

function enqueue(...args: CaptureArgs) {
  if (queue.length < MAX_QUEUED) queue.push(args);
}

function onError(event: ErrorEvent) {
  enqueue(event.error ?? event.message, {
    mechanism: { type: "onerror", handled: false },
  });
}

function onRejection(event: PromiseRejectionEvent) {
  enqueue(event.reason, {
    mechanism: { type: "onunhandledrejection", handled: false },
  });
}

function stopBuffering() {
  window.removeEventListener("error", onError);
  window.removeEventListener("unhandledrejection", onRejection);
}

/** Queue uncaught errors until the SDK's own global handlers are installed. */
export function bufferEarlyErrors() {
  if (!dsn || sdk) return;
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
}

export function loadSentry(): Promise<SentrySdk | null> {
  if (!dsn) return Promise.resolve(null);
  loading ??= import("./sentry-sdk").then(
    (Sentry) => {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV,
      });
      // init() installed the SDK's global handlers; from here on the buffer
      // would only duplicate what they report.
      stopBuffering();
      sdk = Sentry;
      for (const args of queue.splice(0)) Sentry.captureException(...args);
      return Sentry;
    },
    () => {
      stopBuffering();
      queue.length = 0;
      return null;
    },
  );
  return loading;
}

export function captureException(...args: CaptureArgs) {
  if (!dsn) return;
  if (sdk) {
    sdk.captureException(...args);
    return;
  }
  enqueue(...args);
  void loadSentry();
}

export function onRouterTransitionStart(href: string, navigationType: string) {
  sdk?.captureRouterTransitionStart(href, navigationType);
}
