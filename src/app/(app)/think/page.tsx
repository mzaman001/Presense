import { Suspense } from "react";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase-server";
import { fetchThreads } from "@/lib/think-threads";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { ThinkView } from "./ThinkView";

/**
 * Not awaited: the page returns at once and the Active threads stream in, so
 * a navigation back to Think renders from the client cache without waiting
 * on this query. A failure resolves to undefined and the client fetches.
 */
async function loadActiveThreads() {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    // The (app) layout has already redirected a request without a session.
    if (!session) return undefined;
    return await fetchThreads(supabase, session.user.id, "active");
  } catch (err) {
    Sentry.captureException(err);
    return undefined;
  }
}

export default function ThinkPage() {
  return (
    <Suspense
      fallback={
        <div className="py-6">
          <PageSkeleton count={4} type="card" />
        </div>
      }
    >
      <ThinkView
        threadsPromise={loadActiveThreads()}
        // A Server Component renders once per request; this is that
        // request's time, which the client reuses for relative dates.
        // eslint-disable-next-line react-hooks/purity
        renderedAt={Date.now()}
      />
    </Suspense>
  );
}
