import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getLastMutationTime,
  isRecentLocalWrite,
  markMutation,
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

describe("echoes are recognised by row", () => {
  const ok = (body?: unknown) =>
    vi.fn(async () =>
      body === undefined
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify(body), {
            status: 201,
            headers: { "content-type": "application/json" },
          }),
    );

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    resetMutationTracking();
  });
  afterEach(() => vi.useRealTimers());

  it("an update by id mutes only that row, so another device's change still arrives", async () => {
    await trackWrites(ok())(`${REST}/items?id=eq.a1`, { method: "PATCH" });
    expect(isRecentLocalWrite("items", "a1", 500)).toBe(true);
    // The bug: this remote change was dropped for 500ms after any write.
    expect(isRecentLocalWrite("items", "b2", 500)).toBe(false);
    vi.setSystemTime(10_600);
    expect(isRecentLocalWrite("items", "a1", 500)).toBe(false);
  });

  it("reads ids from an id=in.(…) filter", async () => {
    await trackWrites(ok())(`${REST}/items?id=in.(a1,%22b2%22)`, {
      method: "DELETE",
    });
    expect(isRecentLocalWrite("items", "a1", 500)).toBe(true);
    expect(isRecentLocalWrite("items", "b2", 500)).toBe(true);
    expect(isRecentLocalWrite("items", "c3", 500)).toBe(false);
  });

  it("reads ids from the rows sent, or else the rows returned", async () => {
    await trackWrites(ok())(`${REST}/items`, {
      method: "POST",
      body: JSON.stringify([{ id: "s1", title: "x" }]),
    });
    await trackWrites(ok([{ id: "r1" }]))(`${REST}/threads?select=*`, {
      method: "POST",
      body: JSON.stringify({ title: "no id yet" }),
    });
    expect(isRecentLocalWrite("items", "s1", 500)).toBe(true);
    expect(isRecentLocalWrite("threads", "r1", 500)).toBe(true);
    expect(isRecentLocalWrite("threads", "other", 500)).toBe(false);
  });

  it("mutes the whole table when the rows can't be told", async () => {
    await trackWrites(ok())(`${REST}/items?status=eq.inbox`, {
      method: "PATCH",
      body: JSON.stringify({ status: "active" }),
    });
    expect(isRecentLocalWrite("items", "anything", 500)).toBe(true);
    expect(isRecentLocalWrite("threads", "anything", 500)).toBe(false);
  });

  it("keeps manual and RPC stamps table-wide", () => {
    markMutation("locations");
    expect(isRecentLocalWrite("locations", "x", 500)).toBe(true);
    markMutation();
    expect(isRecentLocalWrite("items", "y", 500)).toBe(true);
  });
});
