import { Suspense } from "react";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase-server";
import { fetchLocations } from "@/lib/locations";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { LocationsView } from "./LocationsView";

/**
 * Not awaited: the page returns at once and the list streams in, so a
 * navigation back to Remember renders from the client cache without waiting
 * on this query. A failure resolves to undefined and the client fetches.
 */
async function loadLocations() {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    // The (app) layout has already redirected a request without a session.
    if (!session) return undefined;
    return await fetchLocations(supabase, session.user.id, "");
  } catch (err) {
    Sentry.captureException(err);
    return undefined;
  }
}

export default function LocationsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-6">
          <PageSkeleton count={4} type="task" />
        </div>
      }
    >
      <LocationsView
        itemsPromise={loadLocations()}
        // A Server Component renders once per request; this is that
        // request's time, which the client reuses for staleness badges.
        // eslint-disable-next-line react-hooks/purity
        renderedAt={Date.now()}
      />
    </Suspense>
  );
}
