import type { QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { RoutedItem } from "@/lib/capture-router";

/**
 * Zero-loss capture. A capture is written to this device first and synced
 * to the database afterwards, so "Saved" means saved even with no network,
 * a flaky one, or a tab closed mid-request.
 *
 * Why: people offload less as saving takes more effort (Chiu & Gilbert
 * 2024), and a store that loses even one item teaches them to go back to
 * holding things in their head.
 *
 * Every row gets its id here, when the capture is taken. A retry re-sends
 * the same ids, and a duplicate-key error means an earlier attempt already
 * landed, so retrying can never create a second copy.
 */

type Table = "items" | "threads" | "locations";

export interface OutboxRow {
  table: Table;
  row: Record<string, unknown> & { id: string };
}

export interface PendingCapture {
  id: string;
  /** Exactly what was typed or spoken; kept until every row is saved. */
  text: string;
  rows: OutboxRow[];
  createdAt: string;
  attempts: number;
  lastError?: string;
}

/** After this many failed syncs the capture is shown for review. */
export const STUCK_AFTER_ATTEMPTS = 3;

const storageKey = (userId: string) => `presense_capture_outbox_v1:${userId}`;

// Survives a storage failure (private mode, quota): captures still sync from
// memory this session instead of throwing at the moment of saving.
const memory = new Map<string, PendingCapture[]>();
// Set when a write fails (e.g. storage full) although reads still work;
// from then on memory is the source of truth, so nothing just captured is
// read back as missing.
let storageFailed = false;
const listeners = new Set<() => void>();

export function readOutbox(userId: string): PendingCapture[] {
  if (storageFailed) return memory.get(userId) ?? [];
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey(userId));
  } catch {
    // Storage unavailable: this session's in-memory copy is all there is.
    return memory.get(userId) ?? [];
  }
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PendingCapture[];
  } catch {
    return [];
  }
}

function writeOutbox(userId: string, entries: PendingCapture[]) {
  memory.set(userId, entries);
  try {
    if (entries.length === 0) localStorage.removeItem(storageKey(userId));
    else localStorage.setItem(storageKey(userId), JSON.stringify(entries));
  } catch {
    // Memory copy above still holds it for this session.
    storageFailed = true;
  }
  for (const listener of listeners) listener();
}

export function subscribeOutbox(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith("presense_capture_outbox_v1:")) listener();
  };
  // Another tab syncing (or capturing) changes what this one should show.
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The rows a routed capture turns into, with ids fixed now. */
export function rowsForCapture(
  userId: string,
  items: RoutedItem[],
  now: Date = new Date(),
): OutboxRow[] {
  const createdAt = now.toISOString();
  return items.map((item): OutboxRow => {
    const id = crypto.randomUUID();
    if (item.destinationId === "think") {
      return {
        table: "threads",
        row: {
          id,
          user_id: userId,
          title: item.title.slice(0, 60),
          entries: [
            { text: item.title, created_at: createdAt, starred: false },
          ],
          created_at: createdAt,
        },
      };
    }
    if (item.destinationId === "locations") {
      return {
        table: "locations",
        row: {
          id,
          user_id: userId,
          item_name: item.item_name || item.title.split(" ")[0] || "Item",
          location_text: item.title,
          created_at: createdAt,
        },
      };
    }
    return {
      table: "items",
      row: {
        id,
        user_id: userId,
        title: item.title,
        deadline: item.deadline ? new Date(item.deadline).toISOString() : null,
        recurrence: item.recurrence ?? null,
        status: item.destinationId === "inbox" ? "inbox" : "active",
        created_at: createdAt,
      },
    };
  });
}

export function enqueueCapture(
  userId: string,
  text: string,
  items: RoutedItem[],
  now: Date = new Date(),
): PendingCapture {
  const entry: PendingCapture = {
    id: crypto.randomUUID(),
    text,
    rows: rowsForCapture(userId, items, now),
    createdAt: now.toISOString(),
    attempts: 0,
  };
  writeOutbox(userId, [...readOutbox(userId), entry]);
  return entry;
}

/** The cached lists a synced capture shows up in. */
export function invalidateForCaptures(
  queryClient: QueryClient,
  captures: PendingCapture[],
) {
  const keys = new Set<string>();
  for (const { rows } of captures) {
    for (const { table } of rows) {
      const forTable =
        table === "threads"
          ? [["threads"], ["dashboard"]]
          : table === "locations"
            ? [["locations"]]
            : [["tasks"], ["inbox-tasks"], ["dashboard"]];
      for (const key of forTable) keys.add(JSON.stringify(key));
    }
  }
  for (const key of keys) {
    void queryClient.invalidateQueries(
      { queryKey: JSON.parse(key) as string[] },
      { cancelRefetch: false },
    );
  }
}

const UNIQUE_VIOLATION = "23505";
const inFlight = new Map<string, Promise<FlushResult>>();

export interface FlushResult {
  synced: PendingCapture[];
  remaining: PendingCapture[];
}

/**
 * Sends every pending capture, oldest first. Rows are removed from an entry
 * as they land, so a partly saved capture never re-sends what already
 * arrived. Concurrent calls share one run.
 */
export function flushOutbox(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<FlushResult> {
  const running = inFlight.get(userId);
  if (running) return running;

  const run = (async (): Promise<FlushResult> => {
    const synced: PendingCapture[] = [];
    // Each capture is tried once per run, including any taken while the run
    // is in progress (they would otherwise wait for the next retry).
    const tried = new Set<string>();
    let entry: PendingCapture | undefined;
    while (
      (entry = readOutbox(userId).find((e) => !tried.has(e.id))) !== undefined
    ) {
      tried.add(entry.id);
      let rows = entry.rows;
      let error: string | undefined;
      for (const outboxRow of entry.rows) {
        let insertError: { code?: string; message?: string } | null;
        try {
          ({ error: insertError } = await supabase
            .from(outboxRow.table)
            // The row shape is built per table in rowsForCapture.
            .insert(outboxRow.row as never));
        } catch (thrown) {
          // Offline fetches can reject instead of returning an error.
          insertError = {
            message: thrown instanceof Error ? thrown.message : String(thrown),
          };
        }
        if (insertError && insertError.code !== UNIQUE_VIOLATION) {
          error = insertError.message || "Network error";
          break;
        }
        rows = rows.filter((r) => r.row.id !== outboxRow.row.id);
      }

      // Re-read: a capture may have been added meanwhile.
      const current = readOutbox(userId);
      const id = entry.id;
      if (!error) {
        synced.push(entry);
        writeOutbox(
          userId,
          current.filter((e) => e.id !== id),
        );
      } else {
        writeOutbox(
          userId,
          current.map((e) =>
            e.id === id
              ? { ...e, rows, attempts: e.attempts + 1, lastError: error }
              : e,
          ),
        );
      }
    }
    return { synced, remaining: readOutbox(userId) };
  })();

  const shared = run.finally(() => inFlight.delete(userId));
  inFlight.set(userId, shared);
  return shared;
}
