import { describe, it, expect, vi } from "vitest";
import { appendThreadEntry, removeThreadEntry } from "@/lib/think-threads";

// Entries used to be rebuilt from the page's copy and written whole, and
// deleted by position. Both now go through server functions that change
// only the one entry.
describe("thread entry helpers", () => {
  it("appends through the server function and returns what's stored", async () => {
    const stored = [
      { text: "from the phone", created_at: "2026-10-08T09:00:00.000Z" },
      { text: "from here", created_at: "2026-10-08T09:01:00.000Z" },
    ];
    const rpc = vi.fn(async () => ({ data: stored, error: null }));
    const result = await appendThreadEntry({ rpc } as never, "t1", stored[1]);
    expect(rpc).toHaveBeenCalledWith("append_thread_entry", {
      p_thread_id: "t1",
      p_entry: stored[1],
    });
    expect(result).toEqual(stored);
  });

  it("removes by the entry's timestamp, not its position", async () => {
    const rpc = vi.fn(async () => ({ data: [], error: null }));
    await removeThreadEntry({ rpc } as never, "t1", "2026-10-08T09:01:00.000Z");
    expect(rpc).toHaveBeenCalledWith("remove_thread_entry", {
      p_thread_id: "t1",
      p_created_at: "2026-10-08T09:01:00.000Z",
    });
  });

  it("throws on a failed write", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: "42501" } }));
    await expect(
      appendThreadEntry({ rpc } as never, "t1", { text: "x", created_at: "y" }),
    ).rejects.toBeTruthy();
  });
});
