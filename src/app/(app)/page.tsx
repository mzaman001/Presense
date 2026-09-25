import { Suspense } from "react";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase-server";
import { fetchDashboardRows } from "@/lib/dashboard";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { getUserSettings } from "@/lib/user-settings-server";
import { formatTimeOfDay, greetingFor, hourIn } from "@/lib/greeting";
import { HomeView, type HomeHeader } from "./HomeView";

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

/**
 * Home's header and tip come from the server so they paint with the HTML;
 * only the data below them waits for the browser (it needs the device's
 * timezone). The settings row is the layout's, cached for the request.
 */
async function loadHeader(): Promise<HomeHeader> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const settings = session ? await getUserSettings(session.user.id) : null;
  return {
    greeting: greetingFor(hourIn(settings?.timezone)),
    firstName: settings?.display_name?.trim().split(/\s+/)[0] ?? "",
    eveningReview: formatTimeOfDay(settings?.shutdown_time),
  };
}

export default async function HomePage() {
  const header = await loadHeader();
  return (
    <Suspense fallback={<PageSkeleton count={4} type="card" />}>
      <HomeView rowsPromise={loadRows()} header={header} />
    </Suspense>
  );
}
