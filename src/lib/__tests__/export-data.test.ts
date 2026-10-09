import { describe, it, expect, vi } from "vitest";
import { buildExport } from "@/lib/export-data";

// The export ignored failed requests, stopped at the API's 1,000-row limit
// and left out categories, focus sessions and ritual history.
function supabaseWith(sizes: Record<string, number>, failing?: string) {
  const from = vi.fn((table: string) => {
    let range: [number, number] = [0, 0];
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order"]) q[m] = () => q;
    q.range = (a: number, b: number) => {
      range = [a, b];
      return q;
    };
    q.maybeSingle = async () => ({
      data: { user_id: "u", theme: "warm" },
      error: null,
    });
    q.then = (resolve: (v: unknown) => void) => {
      if (table === failing)
        return resolve({ data: null, error: { code: "57014" } });
      const total = sizes[table] ?? 0;
      const [a, b] = range;
      const n = Math.max(0, Math.min(total, b + 1) - a);
      return resolve({
        data: Array.from({ length: n }, (_, i) => ({
          id: `${table}-${a + i}`,
        })),
        error: null,
      });
    };
    return q;
  });
  return { from } as never;
}

describe("buildExport", () => {
  it("pages past the 1,000-row limit", async () => {
    const out = await buildExport(supabaseWith({ items: 2500 }), "u");
    expect(out.items).toHaveLength(2500);
    expect(out.counts.items).toBe(2500);
  });

  it("includes every table the user owns, and the settings", async () => {
    const out = await buildExport(
      supabaseWith({ categories: 3, session_logs: 4, ritual_logs: 5 }),
      "u",
    );
    expect(out.counts).toMatchObject({
      categories: 3,
      session_logs: 4,
      ritual_logs: 5,
    });
    expect(out.settings).toMatchObject({ theme: "warm" });
  });

  it("fails instead of exporting a table as empty", async () => {
    await expect(
      buildExport(supabaseWith({ items: 10 }, "threads"), "u"),
    ).rejects.toBeTruthy();
  });
});
