/**
 * What this tab last wrote, so RealtimeProvider can ignore the echo of our
 * own change. Lives outside RealtimeProvider because the Supabase client
 * (lib/supabase.ts) stamps writes here, and the provider already imports
 * that client.
 *
 * Writes are recorded per row when the rows are known (an update or delete
 * by id, an insert or upsert that sends or returns ids). Only then is an
 * event for that row an echo; changes to any other row pass straight
 * through. Writes whose rows can't be told (a bulk filter, an RPC, a
 * manual markMutation) fall back to muting the whole table for the window.
 * The table-wide mute used to apply to every write, so a change from
 * another device landing within 500ms of any local write was dropped.
 */
const lastMutations: Record<string, number> = {};
const rowMutations: Record<string, Map<string, number>> = {};

export function markMutation(table?: string, rowIds?: readonly string[]) {
  const now = Date.now();
  if (table && rowIds && rowIds.length > 0) {
    const rows = (rowMutations[table] ??= new Map());
    for (const id of rowIds) rows.set(id, now);
    return;
  }
  lastMutations[table ?? "_global"] = now;
}

/** The last table-wide (row-unknown) write to a table, or 0. */
export function getLastMutationTime(table: string): number {
  return Math.max(lastMutations[table] || 0, lastMutations["_global"] || 0);
}

/**
 * Whether a realtime event is (probably) the echo of this tab's own write:
 * a table-wide write within the window, or a write to this very row.
 */
export function isRecentLocalWrite(
  table: string,
  rowId: string | null | undefined,
  windowMs: number,
  now: number = Date.now(),
): boolean {
  if (now - getLastMutationTime(table) < windowMs) return true;
  if (!rowId) return false;
  const at = rowMutations[table]?.get(rowId);
  if (at === undefined) return false;
  if (now - at < windowMs) return true;
  rowMutations[table]?.delete(rowId);
  return false;
}

/**
 * Clears the echo-suppression timestamps. Only needed by tests: under fake
 * timers `Date.now()` is frozen, so a mutation marked in one test would stay
 * "recent" forever and silently suppress events in the next.
 */
export function resetMutationTracking() {
  for (const key of Object.keys(lastMutations)) delete lastMutations[key];
  for (const key of Object.keys(rowMutations)) delete rowMutations[key];
}

const ID_FILTER = /^(?:eq\.(.+)|in\.\((.*)\))$/;

/** Row ids named by a PostgREST `id=eq.x` / `id=in.(a,b)` filter. */
function idsFromUrl(url: string): string[] {
  let filter: string | null = null;
  try {
    filter = new URL(url).searchParams.get("id");
  } catch {
    return [];
  }
  const m = filter ? ID_FILTER.exec(filter) : null;
  if (!m) return [];
  if (m[1] !== undefined) return [m[1]];
  return m[2]
    .split(",")
    .map((id) => id.trim().replace(/^"(.*)"$/, "$1"))
    .filter(Boolean);
}

/** Ids of the rows in a JSON body (one row or an array of rows). */
function idsFromJson(value: unknown): string[] {
  const rows = Array.isArray(value) ? value : [value];
  const ids: string[] = [];
  for (const row of rows) {
    const id = (row as { id?: unknown } | null)?.id;
    if (typeof id !== "string" && typeof id !== "number") return [];
    ids.push(String(id));
  }
  return ids;
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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
    let ids = table ? idsFromUrl(url) : [];
    if (table && ids.length === 0 && typeof init?.body === "string") {
      ids = idsFromJson(parse(init.body));
    }
    let response: Response | undefined;
    try {
      response = await baseFetch(input, init);
      // An insert that let the database pick ids: they come back when the
      // caller asked for the rows (.select()).
      if (table && ids.length === 0 && response.ok) {
        const type = response.headers.get("content-type") ?? "";
        if (type.includes("json")) {
          ids = idsFromJson(parse(await response.clone().text()));
        }
      }
      return response;
    } finally {
      // Also on failure: a write that timed out client-side may still have
      // committed and echo back.
      markMutation(table, response?.ok === false ? undefined : ids);
    }
  };
}
