import { describe, it, expect, vi } from "vitest";
import { fetchTrash, formatDeletedDate } from "@/lib/trash";

type Rows = Record<string, unknown>[];

function mockClient(byTable: Record<string, Rows | Error>) {
  const from = vi.fn((table: string) => {
    const result = byTable[table];
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order", "limit", "overrideTypes"]) {
      q[m] = vi.fn(() => q);
    }
    q.then = (resolve: (v: unknown) => void) =>
      resolve(
        result instanceof Error
          ? { data: null, error: result }
          : { data: result ?? [], error: null },
      );
    return q;
  });
  return { client: { from } as never, from };
}

describe("fetchTrash", () => {
  it("merges all three tables, newest deletion first", async () => {
    const { client } = mockClient({
      items: [{ id: "i1", deleted_at: "2026-09-01T00:00:00Z", title: "Task" }],
      threads: [
        { id: "t1", deleted_at: "2026-09-03T00:00:00Z", title: "Thread" },
      ],
      locations: [
        { id: "l1", deleted_at: "2026-09-02T00:00:00Z", item_name: "Keys" },
      ],
    });

    const entries = await fetchTrash(client, "u1", null);

    expect(entries.map((e) => [e.id, e.label, e.typeLabel])).toEqual([
      ["t1", "Thread", "Thread"],
      ["l1", "Keys", "Location"],
      ["i1", "Task", "Task"],
    ]);
  });

  it("queries only the filtered table", async () => {
    const { client, from } = mockClient({ threads: [] });
    await fetchTrash(client, "u1", "thread");
    expect(from.mock.calls.map(([t]) => t)).toEqual(["threads"]);
  });

  it("throws instead of reporting an empty trash when a query fails", async () => {
    const { client } = mockClient({
      items: [],
      threads: new Error("boom"),
      locations: [],
    });
    await expect(fetchTrash(client, "u1", null)).rejects.toThrow("boom");
  });
});

describe("formatDeletedDate", () => {
  it("formats in the user's zone, independent of the runtime's", () => {
    // 20:00 UTC on the 22nd is already the 23rd in India.
    expect(formatDeletedDate("2026-09-22T20:00:00Z", "Asia/Kolkata")).toBe(
      "Sep 23, 2026",
    );
    expect(formatDeletedDate("2026-09-22T20:00:00Z", "UTC")).toBe(
      "Sep 22, 2026",
    );
  });

  it("falls back to UTC for an unknown zone and handles missing dates", () => {
    expect(formatDeletedDate("2026-09-22T20:00:00Z", "Not/AZone")).toBe(
      "Sep 22, 2026",
    );
    expect(formatDeletedDate(null, "UTC")).toBe("Unknown");
  });
});
