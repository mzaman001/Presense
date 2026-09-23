/**
 * When each table was last written from this tab, so RealtimeProvider can
 * ignore the echo of our own change. Lives outside RealtimeProvider because
 * the Supabase client (lib/supabase.ts) stamps writes here, and the provider
 * already imports that client.
 */
const lastMutations: Record<string, number> = {};

export function markMutation(table?: string) {
  lastMutations[table ?? "_global"] = Date.now();
}

export function getLastMutationTime(table: string): number {
  return Math.max(lastMutations[table] || 0, lastMutations["_global"] || 0);
}

/**
 * Clears the echo-suppression timestamps. Only needed by tests: under fake
 * timers `Date.now()` is frozen, so a mutation marked in one test would stay
 * "recent" forever and silently suppress events in the next.
 */
export function resetMutationTracking() {
  for (const key of Object.keys(lastMutations)) delete lastMutations[key];
}

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const REST_PATH = /\/rest\/v1\/([^/?#]+)(?:\/([^/?#]+))?/;

/**
 * Wraps the Supabase client's fetch so every write stamps its table when the
 * response arrives. Callers used to stamp before sending, so a write slower
 * than the echo window (435ms measured) let its own echo through and every
 * listener refetched; most writes never stamped at all.
 */
export function trackWrites(baseFetch: typeof fetch): typeof fetch {
  return async (input, init) => {
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const match = READ_METHODS.has(method) ? null : REST_PATH.exec(url);
    if (!match) return baseFetch(input, init);

    // An RPC can write any table.
    const table = match[1] === "rpc" ? undefined : match[1];
    try {
      return await baseFetch(input, init);
    } finally {
      // Also on failure: a write that timed out client-side may still have
      // committed and echo back.
      markMutation(table);
    }
  };
}
