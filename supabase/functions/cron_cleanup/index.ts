// INFRA-23 (Aug 17, 2026): `deno.land/std` is maintenance-mode — built-in
// `Deno.serve` is now the standard entry point. The esm.sh resolution path
// for `@supabase/supabase-js` is fragile; the `npm:` specifier is the
// reliable pattern.
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // SEC2-02 (2026-08-16): this function defaults to `verify_jwt = true`, so every invocation must
  // send a valid Authorization header. Fail loudly with 401 if the trigger (Supabase Dashboard
  // scheduled function / pg_cron + net.http_post) omits it — a silent 401 means cleanup never
  // runs and trash grows unbounded. See EXECUTION_SPEC.md SEC2-02 for the trigger contract.
  if (!req.headers.get("Authorization")) {
    return new Response(
      JSON.stringify({
        error: "No Authorization header — scheduled invocation must send a JWT",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    const results = await Promise.all([
      // Items (Tasks)
      supabase
        .from("items")
        .delete()
        .eq("status", "deleted")
        .not("deleted_at", "is", null)
        .lte("deleted_at", cutoffDate),

      // Threads
      supabase
        .from("threads")
        .delete()
        .eq("status", "deleted")
        .not("deleted_at", "is", null)
        .lte("deleted_at", cutoffDate),

      // Explores
      supabase
        .from("explores")
        .delete()
        .eq("status", "deleted")
        .not("deleted_at", "is", null)
        .lte("deleted_at", cutoffDate),

      // People
      supabase
        .from("people")
        .delete()
        .eq("status", "deleted")
        .not("deleted_at", "is", null)
        .lte("deleted_at", cutoffDate),

      // Locations
      supabase
        .from("locations")
        .delete()
        .eq("status", "deleted")
        .not("deleted_at", "is", null)
        .lte("deleted_at", cutoffDate),
    ]);

    // Check for errors in the results array
    for (const res of results) {
      if (res.error) throw res.error;
    }

    return new Response(
      JSON.stringify({ message: "Hard delete cleanup executed successfully." }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      { headers: { "Content-Type": "application/json" }, status: 500 },
    );
  }
});
