import { cache } from "react";
import { createClient } from "@/lib/supabase-server";

/**
 * The signed-in user's settings row, read once per request: the (app)
 * layout and a page that needs a field (Home's greeting) share one query.
 */
export const getUserSettings = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
});
