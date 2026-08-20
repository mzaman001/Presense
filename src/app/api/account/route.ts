import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { accountDeleteSchema } from "@/lib/schemas";
import * as Sentry from "@sentry/nextjs";

// PERF-17: fail fast — this is a cheap env check that previously ran
// after the auth round trip, the Redis rate-limit call, and body parsing.
// If the service-role key is missing, account deletion can never succeed,
// so reject before any of that work.
export async function DELETE(request: Request) {
  try {
    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      logger.error("[account] SUPABASE_SERVICE_ROLE_KEY is not configured");
      return NextResponse.json(
        {
          error: "Account deletion is not configured. Please contact support.",
        },
        { status: 500 },
      );
    }

    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await checkRateLimit("account", user.id, 3, 60_000))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = accountDeleteSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    if (parsed.data.confirmToken !== user.email) {
      return NextResponse.json(
        { error: "Confirmation token does not match account email" },
        { status: 400 },
      );
    }

    // Create a service-role client for admin operations
    const serviceClient = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Delete the auth user (requires service-role key)
    const { error: deleteAuthError } =
      await serviceClient.auth.admin.deleteUser(user.id);

    if (deleteAuthError) {
      logger.error("[account] deleteUser failed:", deleteAuthError);
      return NextResponse.json(
        { error: "Failed to delete account. Please contact support." },
        { status: 500 },
      );
    }

    // AUDIT-06 (Aug 19, 2026): deleteUser alone orphaned every user-owned
    // row (10 tables) forever — a retention/GDPR gap. Now every table with a
    // user_id FK is swept after the auth deletion succeeds. Per AGENTS
    // invariant 7 every mutation's error is checked; the final response
    // reports per-table outcomes and only {success:true} when the sweep is
    // fully complete.
    const ownedTables = [
      "items",
      "threads",
      "people",
      "explores",
      "locations",
      "push_subscriptions",
      "user_settings",
      "categories",
      "session_logs",
      "ritual_logs",
    ];

    const deleteResults = await Promise.all(
      ownedTables.map((table) =>
        serviceClient.from(table).delete().eq("user_id", user.id),
      ),
    );

    const failures = deleteResults
      .map((res, i) =>
        res.error ? { table: ownedTables[i], error: res.error.message } : null,
      )
      .filter((r): r is { table: string; error: string } => r !== null);

    if (failures.length > 0) {
      logger.error("[account] purge failed for tables:", failures);
      Sentry.captureMessage(
        `[account] purge partial failure for user ${user.id}: ${failures
          .map((f) => `${f.table}: ${f.error}`)
          .join("; ")}`,
        { level: "error" },
      );
      return NextResponse.json(
        {
          error:
            "Account was deleted but some personal data could not be purged. Please contact support.",
          code: "PURGE_PARTIAL",
          failedTables: failures.map((f) => f.table),
        },
        { status: 207 },
      );
    }

    return NextResponse.json({ success: true, purgedTables: ownedTables });
  } catch (error) {
    Sentry.captureException(error);
    logger.error("[account] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete account. Please contact support." },
      { status: 500 },
    );
  }
}
