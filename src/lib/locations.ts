import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { ilikeContains } from "@/lib/utils";

export interface LocationItem {
  id: string;
  item_name: string;
  location_text: string;
  updated_at: string | null;
}

export function locationsQueryKey(search: string) {
  // Under ["locations"], which useRealtime invalidates on any change.
  return ["locations", search.trim()] as const;
}

/**
 * The Remember list, optionally filtered by a search term. Shared by the
 * server page (the unfiltered list, streamed) and the client query.
 */
export async function fetchLocations(
  supabase: SupabaseClient<Database>,
  userId: string,
  search: string,
): Promise<LocationItem[]> {
  // INFRA-18: explicit user_id filter for planner index usage.
  // BUG-08: trashed locations must not render in the list on any client.
  let query = supabase
    .from("locations")
    .select("id, item_name, location_text, updated_at")
    .eq("user_id", userId)
    .neq("status", "deleted")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (search.trim()) {
    const term = ilikeContains(search.trim());
    query = query.or(`item_name.ilike.${term},location_text.ilike.${term}`);
  }
  const { data, error } = await query;
  // Previously `?? []` hid every failure behind the empty state.
  if (error) throw error;
  return data ?? [];
}
