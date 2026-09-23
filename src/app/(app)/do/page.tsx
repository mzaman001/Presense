import { Suspense } from "react";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase-server";
import { fetchActiveTasks } from "@/lib/do-tasks";
import { PageSkeleton } from "@/components/ui/Skeleton";
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

export default function DoPage() {
  return (
    <Suspense fallback={<PageSkeleton count={5} type="task" />}>
      <DoView tasksPromise={loadTasks()} />
    </Suspense>
  );
}
