import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getLastMutationTime,
  resetMutationTracking,
  trackWrites,
} from "@/lib/mutation-tracking";

const REST = "https://x.supabase.co/rest/v1";

function slowFetch(ms: number) {
  return vi.fn(
    () =>
      new Promise<Response>((resolve) =>
        setTimeout(() => resolve(new Response(null, { status: 201 })), ms),
      ),
  );
}

describe("trackWrites", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    resetMutationTracking();
  });
  afterEach(() => vi.useRealTimers());

  // A save measured at 435ms: stamping before the request left the echo,
  // which arrives after the response, outside the 500ms window.
  it("stamps the table when the write completes, not when it starts", async () => {
    const fetchImpl = trackWrites(slowFetch(435));
    const done = fetchImpl(`${REST}/items?select=*`, { method: "POST" });
    await vi.advanceTimersByTimeAsync(435);
    await done;

    expect(getLastMutationTime("items")).toBe(10_435);
    expect(getLastMutationTime("threads")).toBe(0);
  });

  it("ignores reads", async () => {
    const fetchImpl = trackWrites(slowFetch(10));
    for (const method of [undefined, "GET", "HEAD"]) {
      const p = fetchImpl(`${REST}/items?select=id`, { method });
      await vi.advanceTimersByTimeAsync(10);
      await p;
    }
    expect(getLastMutationTime("items")).toBe(0);
  });

  it("treats an RPC as touching every table", async () => {
    const fetchImpl = trackWrites(slowFetch(5));
    const p = fetchImpl(`${REST}/rpc/rename_category`, { method: "POST" });
    await vi.advanceTimersByTimeAsync(5);
    await p;
    expect(getLastMutationTime("items")).toBe(10_005);
  });

  it("stamps a failed write too, since it may still have committed", async () => {
    const fetchImpl = trackWrites(
      vi.fn(() => Promise.reject(new TypeError("network"))),
    );
    await expect(
      fetchImpl(`${REST}/items`, { method: "PATCH" }),
    ).rejects.toThrow("network");
    expect(getLastMutationTime("items")).toBe(10_000);
  });

  it("reads the method from a Request object", async () => {
    const fetchImpl = trackWrites(slowFetch(1));
    const p = fetchImpl(new Request(`${REST}/threads`, { method: "DELETE" }));
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(getLastMutationTime("threads")).toBe(10_001);
  });
});
