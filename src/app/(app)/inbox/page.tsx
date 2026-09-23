import { Suspense } from "react";
import * as Sentry from "@sentry/nextjs";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { fetchInboxItems } from "@/lib/inbox-items";
import { Icon as UiIcon } from "@/components/ui/Icon";
import { InboxView } from "./InboxView";

/**
 * Not awaited: the page returns at once and the items stream in, so a
 * navigation back to Inbox can render from the client cache without waiting
 * on this query. A failure resolves to undefined and the client fetches.
 */
async function loadInbox() {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    // The (app) layout has already redirected a request without a session.
    if (!session) return undefined;
    return await fetchInboxItems(supabase, session.user.id);
  } catch (err) {
    Sentry.captureException(err);
    return undefined;
  }
}

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <UiIcon
            className="h-6 w-6 animate-spin text-[var(--color-text-3)]"
            icon={Loader2}
          />
        </div>
      }
    >
      <InboxView itemsPromise={loadInbox()} />
    </Suspense>
  );
}
