// The part of @sentry/nextjs the browser uses, imported dynamically by
// sentry-client.ts. Dynamically importing "@sentry/nextjs" itself hands the
// bundler the whole namespace, so nothing can be tree-shaken: the lazy chunk
// grew to ~124 KiB gz plus a 38 KiB Replay chunk. Named re-exports keep it to
// what init() and these calls actually reach.
export {
  init,
  captureException,
  captureRouterTransitionStart,
} from "@sentry/nextjs";
