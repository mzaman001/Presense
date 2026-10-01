// INFRA-23 (Aug 17, 2026): `deno.land/std` is maintenance-mode — built-in
// `Deno.serve` is now the standard entry point. The esm.sh resolution path
// for `@supabase/supabase-js` is fragile; the `npm:` specifier is the
// reliable pattern.
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // AUDIT-04 (Aug 19, 2026): `verify_jwt = true` alone was not enough — any
  // signed *user* JWT satisfied it, so any logged-in user could trigger this
  // service-role, RLS-bypassing hard-delete sweep. A configured CRON_SECRET
  // secret now gates authority: the trigger must send `x-cron-secret: <secret>`.
  // If configured and missing/wrong, 401 with a stable error code (never
  // echoes the expected value). If not configured, fall back to the previous
  // JWT presence check (SEC2-02) so deployment stays compatible until set.
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  if (cronSecret) {
    if (req.headers.get("x-cron-secret") !== cronSecret) {
      return new Response(
        JSON.stringify({
          error: "Forbidden",
          code: "CRON_AUTH_FAILED",
          message: "A valid scheduler secret is required.",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
  } else if (!req.headers.get("Authorization")) {
    return new Response(
      JSON.stringify({
        error: "No Authorization header — scheduled invocation must send a JWT",
        code: "CRON_AUTH_FAILED",
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

      // Locations
      supabase
        .from("locations")
        .delete()
        .eq("status", "deleted")
        .not("deleted_at", "is", null)
        .lte("deleted_at", cutoffDate),
    ]);

    // AUDIT-05 (Aug 19, 2026): the previous `Promise.all` + single-throw
    // design reported 500 after some deletes had already committed — a
    // partial run masquerading as total failure with no per-table outcome.
    // Each table now reports independently: `{ status: "ok" | "failed",
    // error? }` per table, with an overall status. A run is only
    // considered complete when every table succeeded.
    const tables = ["items", "threads", "locations"];
    const tableResults = tables.map((table, i) => ({
      table,
      status: results[i].error ? "failed" : "ok",
    }));

    const overallStatus = tableResults.every((r) => r.status === "ok")
      ? "completed"
      : "partial";

    if (overallStatus === "partial") {
      // Error text stays in the logs, not the response (see the catch below).
      console.error(
        "cron_cleanup partial run:",
        JSON.stringify(
          tables.flatMap((table, i) =>
            results[i].error
              ? [{ table, error: results[i].error.message }]
              : [],
          ),
        ),
      );
    }

    return new Response(
      JSON.stringify({
        status: overallStatus,
        message:
          overallStatus === "completed"
            ? "Hard delete cleanup executed successfully."
            : "Cleanup completed with per-table failures — inspect status.",
        tables: tableResults,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    // Details go to the function logs only: database error text can describe
    // schema and data, and the caller (the scheduler) only needs to know it
    // failed. CodeQL js/stack-trace-exposure.
    console.error("cron_cleanup failed:", err);
    return new Response(
      JSON.stringify({ error: "cron_cleanup failed. See the function logs." }),
      { headers: { "Content-Type": "application/json" }, status: 500 },
    );
  }
});
