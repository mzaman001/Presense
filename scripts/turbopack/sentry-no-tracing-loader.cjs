// Turbopack stand-in for @sentry/nextjs's webpack-only
// `webpack.treeshake.removeTracing`, which is a DefinePlugin setting
// __SENTRY_TRACING__ to false. `next build` uses Turbopack, so that option
// never applied and the browser bundle shipped Sentry's tracing code.
//
// next.config.ts runs this only on browser-bound @sentry files. The server
// keeps tracing (tracesSampleRate in sentry.server.config.ts), which is why
// it isn't a global `compiler.define`: that applies to every bundle.
module.exports = function sentryNoTracingLoader(source) {
  return source.replace(/(?<![\w$])__SENTRY_TRACING__(?![\w$])/g, "false");
};
