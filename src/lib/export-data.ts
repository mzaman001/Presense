import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/** Every table that holds the user's own rows. */
const TABLES = [
  "items",
  "threads",
  "locations",
  "categories",
  "session_logs",
  "ritual_logs",
] as const;
type ExportTable = (typeof TABLES)[number];

/** Rows per request: the API returns at most this many at once. */
const PAGE = 1000;

async function fetchAll(
  supabase: SupabaseClient<Database>,
  table: ExportTable,
  userId: string,
): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("user_id", userId)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) return rows;
  }
}

/**
 * Everything the user has, for Settings → Export. It used to ignore a failed
 * request (exporting an empty list and still saying "Export downloaded"),
 * read each table in one request (the API stops at 1,000 rows) and leave
 * out categories, focus sessions and ritual history. It now pages through
 * every table, throws if anything fails, and says what it holds.
 */
export async function buildExport(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date = new Date(),
) {
  const tables = {} as Record<ExportTable, unknown[]>;
  for (const table of TABLES) {
    tables[table] = await fetchAll(supabase, table, userId);
  }
  const { data: settings, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;

  return {
    exported_at: now.toISOString(),
    user_id: userId,
    counts: Object.fromEntries(
      TABLES.map((table) => [table, tables[table].length]),
    ) as Record<ExportTable, number>,
    ...tables,
    settings: settings ?? {},
  };
}
