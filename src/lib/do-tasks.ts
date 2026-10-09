import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { TaskRecord } from "@/lib/task-cache";

/**
 * The Do page's task list. Shared by the server page (streamed first load)
 * and the client query (refetches), so both return the same rows.
 */
export async function fetchActiveTasks(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<TaskRecord[]> {
  // INFRA-18: explicit user_id filter lets the planner use the
  // idx_items_user_status index directly instead of only the RLS policy.
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["active", "overdue"])
    .order("priority", { ascending: true, nullsFirst: false })
    .order("deadline", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as TaskRecord[];
}

/** Completed tasks shown per page in Do's archive. */
export const ARCHIVE_PAGE = 100;

/**
 * The newest `limit` completed tasks, and whether there are more. The archive
 * used to load every task ever completed in one request.
 */
export async function fetchArchivedPage(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit: number = ARCHIVE_PAGE,
): Promise<{ tasks: TaskRecord[]; hasMore: boolean }> {
  // One row past the page says whether another page exists.
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "done")
    .order("completed_at", { ascending: false })
    .range(0, limit);
  if (error) throw error;
  const rows = (data ?? []) as TaskRecord[];
  return { tasks: rows.slice(0, limit), hasMore: rows.length > limit };
}
