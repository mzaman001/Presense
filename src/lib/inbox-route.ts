import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { activateItemPatch, restoreItemPatch } from "@/lib/item-lifecycle";

export type InboxSpace = "do" | "remember" | "think";

type ItemRow = Database["public"]["Tables"]["items"]["Row"];

/**
 * Sends an inbox item to a space and returns how to take it back.
 *
 * Do: the item itself becomes a task. Remember / Think: a location or thread
 * is created from it, and then the inbox row is removed. It used to be moved
 * to Trash instead, so every routed item showed up there as a deleted task
 * for 30 days though nothing had been deleted. Undo puts the original row
 * back as it was (all of it, read before routing), and removes what was
 * created.
 */
export async function routeInboxItem(
  supabase: SupabaseClient<Database>,
  item: { id: string; title: string; user_id: string | null },
  space: InboxSpace,
): Promise<() => Promise<void>> {
  const { id } = item;

  if (space === "do") {
    const { error } = await supabase
      .from("items")
      .update(activateItemPatch())
      .eq("id", id);
    if (error) throw new Error("Route to Do failed");
    return async () => {
      const { error: undoError } = await supabase
        .from("items")
        .update(restoreItemPatch("inbox"))
        .eq("id", id);
      if (undoError) throw new Error("Undo failed");
    };
  }

  // The whole row, so undo can put it back exactly.
  const { data: original, error: readError } = await supabase
    .from("items")
    .select("*")
    .eq("id", id)
    .single();
  if (readError || !original) throw new Error("Couldn't read the item");

  const table = space === "remember" ? "locations" : "threads";
  const { data: created, error: insertError } =
    space === "remember"
      ? await supabase
          .from("locations")
          .insert({
            user_id: item.user_id ?? original.user_id,
            item_name: item.title,
            location_text: item.title,
          })
          .select("id")
          .single()
      : await supabase
          .from("threads")
          .insert({
            user_id: item.user_id ?? original.user_id,
            title: item.title,
            color_accent: "#e3875f",
          })
          .select("id")
          .single();
  if (insertError || !created) throw new Error("Route failed");

  // Insert first, remove the inbox row only once that worked.
  const { error: deleteError } = await supabase
    .from("items")
    .delete()
    .eq("id", id);
  if (deleteError) {
    await supabase.from(table).delete().eq("id", created.id);
    throw new Error("Couldn't remove it from Inbox");
  }

  return async () => {
    const { error: restoreError } = await supabase
      .from("items")
      .insert(original as ItemRow);
    if (restoreError) throw new Error("Undo failed");
    await supabase.from(table).delete().eq("id", created.id);
  };
}
