import { redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase-server";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchTrash, isTrashType, type TrashEntry } from "@/lib/trash";
import { TrashList } from "./TrashList";

export default async function TrashPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[] }>;
}) {
  const supabase = await createClient();
  const [
    {
      data: { session },
    },
    { filter },
  ] = await Promise.all([supabase.auth.getSession(), searchParams]);

  // The proxy validated the session with getUser() on this request; the
  // (app) layout reads it from cookies the same way.
  const userId = session?.user.id;
  if (!userId) redirect("/login");

  // Per-space pointers link here with ?filter=<type> to scope the view.
  const filterParam = typeof filter === "string" ? filter : null;
  const filterType = isTrashType(filterParam) ? filterParam : null;

  const [entries, { data: settings }] = await Promise.all([
    // A failed fetch leaves the list to retry on the client, where it shows
    // the error state and a "Try again" button.
    fetchTrash(supabase, userId, filterType).catch((err: unknown) => {
      Sentry.captureException(err);
      return undefined as TrashEntry[] | undefined;
    }),
    supabase
      .from("user_settings")
      .select("timezone")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 mx-auto max-w-4xl space-y-6 duration-300">
      <PageHeader
        title="Trash"
        description="Things you've let go of. Restore them, or remove them for good."
      />
      <TrashList
        filterType={filterType}
        initialEntries={entries}
        timeZone={settings?.timezone || "UTC"}
      />
    </div>
  );
}
