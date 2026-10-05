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
 * Home's header and the clock it's drawn with. One clock for the whole
 * page: the saved timezone and the request time. Home renders with it on
 * the server and the browser's first render reuses it, so the two always
 * agree (see display-clock). The settings row is the layout's, cached for
 * the request.
 */
async function loadHeader(): Promise<{
  header: HomeHeader;
  clock: { timeZone: string; now: number };
}> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const settings = session ? await getUserSettings(session.user.id) : null;
  const clock = { timeZone: settings?.timezone || "UTC", now: Date.now() };
  return {
    header: {
      greeting: greetingFor(hourIn(clock.timeZone, new Date(clock.now))),
      firstName: settings?.display_name?.trim().split(/\s+/)[0] ?? "",
      eveningReview: formatTimeOfDay(settings?.shutdown_time),
    },
    clock,
  };
}

export default async function HomePage() {
  const { header, clock } = await loadHeader();
  return (
    <Suspense fallback={<PageSkeleton count={4} type="card" />}>
      <HomeView rowsPromise={loadRows()} header={header} clock={clock} />
    </Suspense>
  );
}
