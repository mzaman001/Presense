import { Suspense } from "react";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase-server";
import { fetchActiveTasks } from "@/lib/do-tasks";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { getUserSettings } from "@/lib/user-settings-server";
import { DoView } from "./DoView";

/**
 * Not awaited: the page returns at once and the tasks stream in, so a
 * navigation back to Do can render from the client cache without waiting on
 * this query. A failure resolves to null and the client fetches instead.
 */
async function loadTasks() {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    // The (app) layout has already redirected a request without a session.
    if (!session) return null;
    return await fetchActiveTasks(supabase, session.user.id);
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

/**
 * The timezone and moment the list is drawn for. The settings row is the
 * layout's, cached for the request, so this costs no extra query. With
 * automatic timezone on (the default) it already matches the device.
 */
async function loadClock() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const settings = session ? await getUserSettings(session.user.id) : null;
  return { timeZone: settings?.timezone || "UTC", now: Date.now() };
}

export default async function DoPage() {
  const clock = await loadClock();
  return (
    <Suspense fallback={<PageSkeleton count={5} type="task" />}>
      <DoView tasksPromise={loadTasks()} clock={clock} />
    </Suspense>
  );
}
