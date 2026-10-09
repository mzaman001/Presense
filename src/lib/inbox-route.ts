import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { activateItemPatch, restoreItemPatch } from "@/lib/item-lifecycle";
import { routeCapture, type RoutedItem } from "@/lib/capture-router";
import { rowsForCapture } from "@/lib/capture-outbox";

/** The router's reading of a location, or the whole text as both parts. */
async function asLocation(text: string): Promise<RoutedItem> {
  try {
    const [first] = await routeCapture(text, {});
    if (first?.destinationId === "locations" && first.item_name) return first;
  } catch {
    // Parsing unavailable: keep the text whole.
  }
  return {
    type: "location",
    title: text,
    destination: "Remember → Locations",
    destinationId: "locations",
    item_name: text,
    confidence: 1,
    reason: "inbox_route",
  };
}

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

  // The same rows a capture would make: a thread with the text as its first
  // entry; a location split into what and where when the text says so
  // ("my keys are in the drawer"). Routing used to put the whole text in
  // both location fields, and start the thread empty.
  const userId = item.user_id ?? original.user_id;
  const routed: RoutedItem =
    space === "remember"
      ? await asLocation(item.title)
      : {
          type: "thought",
          title: item.title,
          destination: "Think",
          destinationId: "think",
          confidence: 1,
          reason: "inbox_route",
        };
  const [{ table, row }] = rowsForCapture(userId, [routed]);
  const { data: created, error: insertError } = await supabase
    .from(table)
    .insert(row as never)
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
