import { Suspense } from "react";
import { describe, it, expect, vi } from "vitest";
import { act, screen, fireEvent } from "@testing-library/react";
import { render } from "@/lib/__tests__/test-utils";

// A place opened for editing only from a click on its card (a plain div):
// keyboard and screen-reader users couldn't edit it.
const place = {
  id: "p1",
  item_name: "Keys",
  location_text: "drawer by the door",
  updated_at: new Date().toISOString(),
};

function listQuery() {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "or", "order", "limit", "ilike"]) {
    q[m] = () => q;
  }
  q.then = (resolve: (v: unknown) => void) =>
    resolve({ data: [place], error: null });
  return q;
}
vi.mock("@/lib/supabase", () => ({
  createClient: () => ({ from: () => listQuery(), channel: vi.fn() }),
}));

import { LocationsView } from "@/app/(app)/remember/locations/LocationsView";

describe("LocationsView", () => {
  it("opens a place from a real, focusable Edit button", async () => {
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <LocationsView
            itemsPromise={Promise.resolve([place] as never)}
            renderedAt={Date.now()}
          />
        </Suspense>,
      );
    });
    const edit = await screen.findByRole("button", { name: "Edit Keys" });
    edit.focus();
    expect(document.activeElement).toBe(edit);
    fireEvent.click(edit);
    expect(
      await screen.findByRole("dialog", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
  });
});
