import React from "react";
import {
  render as rtlRender,
  type RenderOptions,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/components/providers/SessionProvider";
import type { TaskRecord } from "@/lib/task-cache";

export const TEST_USER = { id: "user-123", email: "test@example.com" };

/**
 * Supplies the session context the app layout always provides, so component
 * tests exercise the same tree the real app renders.
 *
 * RealtimeProvider is deliberately not included: it opens a Supabase channel
 * on mount, and each suite mocks the Supabase client differently. Tests that
 * care about live updates wrap in it explicitly.
 */
function AllProviders({ children }: { children: React.ReactNode }) {
  // A fresh cache per render so no test sees another's data. Suites that
  // need to inspect the cache still wrap in their own provider (inner wins).
  const [queryClient] = React.useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider user={TEST_USER}>{children}</SessionProvider>
    </QueryClientProvider>
  );
}

export function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(ui, { wrapper: AllProviders, ...options });
}

/**
 * A complete `items` row for component fixtures. Spread and override only
 * the columns a test cares about, so adding a column does not break every
 * fixture.
 */
export function makeTask(
  overrides: Partial<TaskRecord> & { id: string },
): TaskRecord {
  return {
    category: null,
    completed_at: null,
    created_at: null,
    deadline: null,
    defer_count: 0,
    first_deferred_at: null,
    stuck_dismissed_until: null,
    stuck_dismissals: 0,
    deleted_at: null,
    first_step: null,
    ifthen_trigger: null,
    notes: null,
    notification_sent_1h: null,
    notification_sent_24h: null,
    notification_sent_6h: null,
    notification_sent_72h: null,
    notification_sent_overdue: null,
    priority: null,
    recurrence: null,
    snoozed_until: null,
    start_date: null,
    status: "active",
    subtasks: null,
    time_estimate: null,
    time_spent_minutes: null,
    title: "Untitled",
    user_id: TEST_USER.id,
    ...overrides,
  };
}

export * from "@testing-library/react";
