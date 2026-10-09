import { Suspense } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "@/lib/__tests__/test-utils";
import type { TrashEntry } from "@/lib/trash";

// Restoring showed "Unknown error" (Supabase errors aren't Error objects) or
// raw database text; restoring a repeating task whose next copy is already
// active failed on the one-active-copy index with no explanation.

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() },
}));

let updateResult: { error: { code: string; message: string } | null } = {
  error: null,
};
// The list query (fetchTrash) chains select/eq/order/limit/overrideTypes,
// once per trash table. Only `items` holds the entry: returning it for every
// table showed three rows (three Restore buttons) once the query refetched.
function listQuery(table: string) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit", "overrideTypes"]) {
    q[m] = () => q;
  }
  q.then = (resolve: (v: unknown) => void) =>
    resolve({
      data:
        table === "items"
          ? [
              {
                id: "t1",
                deleted_at: "2026-10-06T10:00:00Z",
                title: "Water plants",
              },
            ]
          : [],
      error: null,
    });
  return q;
}

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    from: (table: string) => ({
      ...listQuery(table),
      update: () => ({ eq: async () => updateResult }),
      delete: () => ({ eq: async () => updateResult }),
    }),
  }),
}));

import { TrashList } from "@/app/(app)/trash/TrashList";

const entry: TrashEntry = {
  id: "t1",
  label: "Water plants",
  typeLabel: "Task",
  deletedAt: "2026-10-06T10:00:00Z",
  type: "item",
  table: "items",
};

async function renderList() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <TrashList
          filterType={null}
          entriesPromise={Promise.resolve([entry])}
        />
      </Suspense>,
    );
  });
  // Let the on-mount refetch land first (slower CI runners got it before
  // the click), so the list the test clicks in is the settled one.
  await act(() => new Promise((r) => setTimeout(r, 100)));
  return screen.getByRole("button", { name: /restore/i });
}

describe("TrashList restore errors", () => {
  beforeEach(() => toastError.mockClear());

  it("explains a repeating task that's already on the list", async () => {
    updateResult = {
      error: { code: "23505", message: "duplicate key value violates…" },
    };
    fireEvent.click(await renderList());
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Couldn't restore it", {
        description: "This repeating task is already on your list.",
      }),
    );
  });

  it("never shows database text for other failures", async () => {
    updateResult = { error: { code: "42501", message: "permission denied" } };
    fireEvent.click(await renderList());
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Couldn't restore it", {
        description: "Please try again.",
      }),
    );
  });
});
