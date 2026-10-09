import { describe, it, expect, vi } from "vitest";
import { fetchArchivedPage } from "@/lib/do-tasks";
import { makeTask } from "@/lib/__tests__/test-utils";

function supabaseReturning(count: number) {
  const range = vi.fn(async (from: number, to: number) => ({
    data: Array.from({ length: Math.min(count, to - from + 1) }, (_, i) =>
      makeTask({ id: `t${i}`, status: "done" }),
    ),
    error: null,
  }));
  const q: Record<string, unknown> = { range };
  for (const m of ["select", "eq", "order"]) q[m] = () => q;
  return { supabase: { from: () => q } as never, range };
}

describe("fetchArchivedPage", () => {
  it("asks for one page plus one row, never everything", async () => {
    const { supabase, range } = supabaseReturning(5000);
    const page = await fetchArchivedPage(supabase, "u", 100);
    expect(range).toHaveBeenCalledWith(0, 100);
    expect(page.tasks).toHaveLength(100);
    expect(page.hasMore).toBe(true);
  });

  it("says there's no more when the archive fits", async () => {
    const { supabase } = supabaseReturning(42);
    const page = await fetchArchivedPage(supabase, "u", 100);
    expect(page.tasks).toHaveLength(42);
    expect(page.hasMore).toBe(false);
  });
});
