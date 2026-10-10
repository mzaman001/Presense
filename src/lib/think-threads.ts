import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type ThreadView = "active" | "archive" | "trash";

export interface Thread {
  id: string;
  title: string;
  color_accent: string;
  entries: Array<{ text: string; created_at: string; starred?: boolean }>;
  stale_prompt: string | null;
  last_updated: string;
  status: string;
  is_pinned: boolean;
}

const STATUS_BY_VIEW: Record<ThreadView, string> = {
  active: "active",
  archive: "archived",
  trash: "deleted",
};

export function threadsQueryKey(view: ThreadView) {
  // Under ["threads"], which useRealtime invalidates on any threads change.
  return ["threads", view] as const;
}

/**
 * The Think list for one view. Shared by the server page (streamed first
 * load) and the client query. Whole rows, because opening a thread hands the
 * row to the detail page as its prefetched copy.
 */
export async function fetchThreads(
  supabase: SupabaseClient<Database>,
  userId: string,
  view: ThreadView,
): Promise<Thread[]> {
  // INFRA-18: explicit user_id filter for planner index usage.
  const { data, error } = await supabase
    .from("threads")
    .select("*")
    .eq("user_id", userId)
    .eq("status", STATUS_BY_VIEW[view])
    .order("is_pinned", { ascending: false })
    .order("last_updated", { ascending: false });
  if (error) throw error;
  return (data as unknown as Thread[]) ?? [];
}

export type ThreadEntry = Thread["entries"][number];

export interface ThreadSearchHit {
  id: string;
  title: string;
  /** The newest entry that matched, or null when only the title did. */
  snippet: string | null;
}

/**
 * Threads whose title or any entry matches (search_threads). Entries are a
 * jsonb[], which a PostgREST filter can't search, so global search used to
 * match titles only.
 */
export async function searchThreads(
  supabase: SupabaseClient<Database>,
  query: string,
  limit = 5,
): Promise<ThreadSearchHit[]> {
  const { data, error } = await supabase.rpc("search_threads", {
    p_query: query,
    p_limit: limit,
  });
  if (error) throw error;
  return ((data ?? []) as ThreadSearchHit[]).map((hit) => ({
    id: hit.id,
    title: hit.title,
    snippet: hit.snippet ?? null,
  }));
}

/**
 * The part of `text` around the first match of `query`, at most about
 * `max` characters, with an ellipsis where it was cut.
 */
export function snippetAround(text: string, query: string, max = 80): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const at = flat.toLowerCase().indexOf(query.trim().toLowerCase());
  const start = Math.max(
    0,
    Math.min(at < 0 ? 0 : at - Math.floor(max / 3), flat.length - max),
  );
  const end = Math.min(flat.length, start + max);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end).trim()}${end < flat.length ? "…" : ""}`;
}

/**
 * Adds an entry on the server (append_thread_entry), so an entry added
 * meanwhile on another device isn't overwritten: the array used to be
 * rebuilt from this page's copy and written whole. Returns what's stored.
 */
export async function appendThreadEntry(
  supabase: SupabaseClient<Database>,
  threadId: string,
  entry: ThreadEntry,
): Promise<ThreadEntry[]> {
  const { data, error } = await supabase.rpc("append_thread_entry", {
    p_thread_id: threadId,
    p_entry: entry,
  });
  if (error) throw error;
  return (data as unknown as ThreadEntry[]) ?? [];
}

/**
 * Removes the entry with this created_at (remove_thread_entry). Deleting by
 * position removed a different entry once the list had changed.
 */
export async function removeThreadEntry(
  supabase: SupabaseClient<Database>,
  threadId: string,
  createdAt: string,
): Promise<ThreadEntry[]> {
  const { data, error } = await supabase.rpc("remove_thread_entry", {
    p_thread_id: threadId,
    p_created_at: createdAt,
  });
  if (error) throw error;
  return (data as unknown as ThreadEntry[]) ?? [];
}
