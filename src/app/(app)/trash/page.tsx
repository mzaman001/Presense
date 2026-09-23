import { Suspense } from "react";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase-server";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchTrash, isTrashType, type TrashType } from "@/lib/trash";
import { TrashList, TrashLoading } from "./TrashList";

/**
 * Not awaited by the page: the entries stream in, so a client navigation to
 * Trash renders from the React Query cache without waiting on this query.
 * A failure resolves to undefined and the list fetches (and shows its error
 * state) on the client.
 */
async function loadTrash(filterType: TrashType | null) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    // The (app) layout has already redirected a request without a session.
    if (!session) return undefined;
    return await fetchTrash(supabase, session.user.id, filterType);
  } catch (err) {
    Sentry.captureException(err);
    return undefined;
  }
}

export default async function TrashPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[] }>;
}) {
  // Per-space pointers link here with ?filter=<type> to scope the view.
  const { filter } = await searchParams;
  const filterParam = typeof filter === "string" ? filter : null;
  const filterType = isTrashType(filterParam) ? filterParam : null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 mx-auto max-w-4xl space-y-6 duration-300">
      <PageHeader
        title="Trash"
        description="Things you've let go of. Restore them, or remove them for good."
      />
      <Suspense fallback={<TrashLoading />}>
        <TrashList
          filterType={filterType}
          entriesPromise={loadTrash(filterType)}
        />
      </Suspense>
    </div>
  );
}
