import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export interface InboxItem {
  id: string;
  title: string;
  user_id: string;
}

/**
 * The Inbox list. Shared by the server page (streamed first load) and the
 * client query (refetches), so both return the same rows. Only the columns
 * the list renders are selected.
 */
export async function fetchInboxItems(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<InboxItem[]> {
  // INFRA-18: explicit user_id filter for planner index usage.
  const { data, error } = await supabase
    .from("items")
    .select("id, title, user_id")
    .eq("user_id", userId)
    .eq("status", "inbox")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
