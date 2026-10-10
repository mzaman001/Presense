// Options every Sentry.init() shares: browser (sentry-client.ts), server and
// edge (src/sentry.*.config.ts). Kept free of imports so the browser can use
// it without pulling in the SDK.
//
// Sentry 11 collects far more by default than 10 did: cookies (here that's
// the Supabase session), request and response bodies, user info, database
// query data. None of that should leave for an error report, so this pins
// v10's restrictive baseline, as written in Sentry's v10 -> v11 migration
// guide ("If you want to keep the v10 default behavior"). Widen a category
// deliberately, never by leaving this out.
export const sentryDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: {
    request: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
    response: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
  },
  httpBodies: [],
  urlQueryParams: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  graphQL: { document: false, variables: false },
};

export const sentrySharedOptions = {
  dataCollection: sentryDataCollection,
  // v11 attaches a synthetic stack trace to captureMessage and to
  // non-Error captureException calls by default, which regroups issues and
  // counts informational messages (rate-limit warnings) as errored sessions.
  // Kept at v10's behaviour.
  attachStacktrace: false,
};
