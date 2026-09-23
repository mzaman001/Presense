import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * The three soft-deletable entities. `table` is the Supabase table; `type` is
 * the value per-space pointers pass as `?filter=`.
 */
export const TRASH_SOURCES = [
  { type: "item", table: "items", label: "Task", nameColumn: "title" },
  { type: "thread", table: "threads", label: "Thread", nameColumn: "title" },
  {
    type: "location",
    table: "locations",
    // `locations` has no `name` column — its display-name column is
    // `item_name` (see `src/types/database.types.ts`). The prior value
    // here ("name") made every /trash load for a `location` row 42703
    // ("column locations.name does not exist"), which surfaced as the
    // whole page's isError branch since all three sources are queried
    // together in one Promise.all.
    label: "Location",
    nameColumn: "item_name",
  },
] as const;

export type TrashType = (typeof TRASH_SOURCES)[number]["type"];
export type TrashTable = (typeof TRASH_SOURCES)[number]["table"];

export interface TrashEntry {
  id: string;
  /** Display name, read from each table's own title/name/item_name column. */
  label: string;
  typeLabel: string;
  deletedAt: string | null;
  type: TrashType;
  table: TrashTable;
}

export function isTrashType(value: string | null): value is TrashType {
  return TRASH_SOURCES.some((source) => source.type === value);
}

export function trashQueryKey(filterType: TrashType | null) {
  return ["trash", filterType] as const;
}

/**
 * Shared by the server page (first paint) and the client list (refetch after
 * restore/delete), so both always build the same entries.
 */
export async function fetchTrash(
  supabase: SupabaseClient<Database>,
  userId: string,
  filterType: TrashType | null,
): Promise<TrashEntry[]> {
  // A scoped view queries only its own table rather than fetching all three
  // and discarding two.
  const sources = filterType
    ? TRASH_SOURCES.filter((source) => source.type === filterType)
    : TRASH_SOURCES;

  const results = await Promise.all(
    sources.map(async (source) => {
      // Narrow projection: the list shows a name and a date, so there is
      // no reason to pull whole rows across the wire. The select string
      // is a literal per branch (not a template interpolation of
      // `source.nameColumn`) so the generated Database types still
      // check the columns.
      const query = supabase
        .from(source.table)
        .select(
          source.nameColumn === "title"
            ? "id, deleted_at, title"
            : "id, deleted_at, item_name",
        )
        .eq("user_id", userId)
        .eq("status", "deleted")
        .order("deleted_at", { ascending: false })
        .limit(200)
        // The select string varies per table, so the generated row type
        // widens to a union the builder cannot narrow. The columns are
        // still checked against Database above; this only pins the shape
        // the mapper below reads.
        .overrideTypes<
          {
            id: string;
            deleted_at: string | null;
            title?: string | null;
            item_name?: string | null;
          }[]
        >();

      const { data, error } = await query;

      // Surface the failure instead of rendering "Trash is empty" — the
      // old code swallowed every error with `|| []`, so a broken query
      // was indistinguishable from an actually empty trash.
      if (error) throw error;

      return (data ?? []).map((row): TrashEntry => ({
        id: row.id,
        label: row.title ?? row.item_name ?? "Untitled",
        typeLabel: source.label,
        deletedAt: row.deleted_at,
        type: source.type,
        table: source.table,
      }));
    }),
  );

  return results
    .flat()
    .sort(
      (a, b) =>
        new Date(b.deletedAt ?? 0).getTime() -
        new Date(a.deletedAt ?? 0).getTime(),
    );
}

/**
 * Fixed locale and an explicit zone, so the server render and the client
 * hydrate produce the same string. `toLocaleDateString()` used the runtime's
 * locale and zone, which differ between Vercel and the browser.
 */
export function formatDeletedDate(
  iso: string | null,
  timeZone: string,
): string {
  if (!iso) return "Unknown";
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeZone,
    }).format(new Date(iso));
  } catch {
    // An unrecognised zone name throws a RangeError.
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(iso));
  }
}
