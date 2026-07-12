import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { Database } from "@/types/database.types";
import { toast } from "sonner";

let clientInstance: ReturnType<typeof createBrowserClient<Database>> | null =
  null;

export function createClient() {
  if (typeof window === "undefined") {
    return createBrowserClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  }

  if (!clientInstance) {
    clientInstance = createBrowserClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  }
  return clientInstance;
}

/**
 * BUG-38: Safe wrapper for Supabase mutations.
 *
 * Supabase-js resolves normally with { data: null, error: { ... } } on a
 * database-level failure — it does NOT throw. A bare try/catch around the call
 * therefore only catches network / JS exceptions, not DB rejections.
 *
 * Usage:
 *   const { success, data, error } = await safeMutate(
 *     () => supabase.from('items').update(...).eq('id', id),
 *     'Failed to update item',
 *   );
 *   if (!success) return; // toast already shown
 *
 * @param mutationFn  A zero-arg function that returns the Supabase query promise.
 * @param errorLabel  Human-readable label shown in toast.error on failure.
 */
export async function safeMutate<T>(
  mutationFn: () => PromiseLike<{
    data: T | null;
    error: { message: string } | null;
  }>,
  errorLabel: string,
): Promise<{
  success: boolean;
  data: T | null;
  error: { message: string } | null;
}> {
  try {
    const { data, error } = await mutationFn();
    if (error) {
      toast.error(errorLabel, { description: error.message });
      return { success: false, data: null, error };
    }
    return { success: true, data, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    toast.error(errorLabel, { description: message });
    return { success: false, data: null, error: { message } };
  }
}
