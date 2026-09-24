import { Suspense } from "react";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase-server";
import { fetchDashboardRows } from "@/lib/dashboard";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { HomeView } from "./HomeView";

/**
 * Not awaited: the page returns at once and Home's rows stream in, so a
 * navigation back to Home can render from the client cache without waiting
 * on these queries. A failure resolves to null and the client fetches.
 */
async function loadRows() {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    // The (app) layout has already redirected a request without a session.
    if (!session) return null;
    return await fetchDashboardRows(supabase, session.user.id);
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton count={4} type="card" />}>
      <HomeView rowsPromise={loadRows()} />
    </Suspense>
  );
}
