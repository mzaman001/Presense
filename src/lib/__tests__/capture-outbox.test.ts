import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { RoutedItem } from "@/lib/capture-router";
import {
  enqueueCapture,
  flushOutbox,
  readOutbox,
  rowsForCapture,
} from "@/lib/capture-outbox";

const USER = "user-1";

const item = (over: Partial<RoutedItem> = {}): RoutedItem => ({
  type: "task",
  title: "Buy milk",
  destination: "Do",
  destinationId: "do",
  confidence: 0.9,
  reason: "test",
  ...over,
});

type Result = { error: { code?: string; message: string } | null };

/** A client whose inserts answer from a queue, recording every call. */
function fakeClient(results: Array<Result | Error> = []) {
  const calls: Array<{ table: string; row: Record<string, unknown> }> = [];
  const client = {
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        calls.push({ table, row });
        const next = results.shift() ?? { error: null };
        if (next instanceof Error) throw next;
        return next;
      },
    }),
  } as unknown as SupabaseClient<Database>;
  return { client, calls };
}

describe("capture outbox", () => {
  beforeEach(() => localStorage.clear());

  it("maps each destination to its table, with ids and the capture time fixed", () => {
    const now = new Date("2026-09-24T08:00:00Z");
    const rows = rowsForCapture(
      USER,
      [
        item({ deadline: "2026-09-25T09:00:00" }),
        item({ destinationId: "inbox", title: "Idea" }),
        item({ destinationId: "think", title: "A".repeat(80) }),
        item({
          destinationId: "locations",
          title: "Keys in the drawer",
          item_name: "Keys",
        }),
      ],
      now,
    );
    expect(rows.map((r) => r.table)).toEqual([
      "items",
      "items",
      "threads",
      "locations",
    ]);
    expect(rows[0].row).toMatchObject({
      status: "active",
      created_at: now.toISOString(),
    });
    expect(rows[1].row).toMatchObject({ status: "inbox", deadline: null });
    expect((rows[2].row.title as string).length).toBe(60);
    expect(rows[3].row).toMatchObject({
      item_name: "Keys",
      location_text: "Keys in the drawer",
    });
    expect(new Set(rows.map((r) => r.row.id)).size).toBe(4);
  });

  it("keeps a capture until it lands, then clears it", async () => {
    enqueueCapture(USER, "Buy milk", [item()]);
    expect(readOutbox(USER)).toHaveLength(1);

    const { client, calls } = fakeClient();
    const { synced, remaining } = await flushOutbox(client, USER);

    expect(calls).toHaveLength(1);
    expect(synced.map((c) => c.text)).toEqual(["Buy milk"]);
    expect(remaining).toEqual([]);
  });

  it("keeps a failed capture with its text and counts the attempt", async () => {
    enqueueCapture(USER, "Buy milk", [item()]);
    const { client } = fakeClient([{ error: { message: "offline" } }]);

    await flushOutbox(client, USER);

    expect(readOutbox(USER)).toEqual([
      expect.objectContaining({
        text: "Buy milk",
        attempts: 1,
        lastError: "offline",
      }),
    ]);
  });

  it("treats a thrown fetch as a failed attempt, not a crash", async () => {
    enqueueCapture(USER, "Buy milk", [item()]);
    const { client } = fakeClient([new TypeError("Failed to fetch")]);

    await expect(flushOutbox(client, USER)).resolves.toBeDefined();
    expect(readOutbox(USER)[0]).toMatchObject({
      attempts: 1,
      lastError: "Failed to fetch",
    });
  });

  it("resends only the rows that didn't land, with the same ids", async () => {
    enqueueCapture(USER, "Buy milk also call mom", [
      item(),
      item({ title: "Call mom" }),
    ]);
    const first = fakeClient([
      { error: null },
      { error: { message: "offline" } },
    ]);
    await flushOutbox(first.client, USER);

    const [pending] = readOutbox(USER);
    expect(pending.rows).toHaveLength(1);
    expect(pending.rows[0].row.title).toBe("Call mom");

    const second = fakeClient();
    await flushOutbox(second.client, USER);
    expect(second.calls.map((c) => c.row.id)).toEqual([first.calls[1].row.id]);
    expect(readOutbox(USER)).toEqual([]);
  });

  it("counts a duplicate key as already saved, so a retry never makes a copy", async () => {
    enqueueCapture(USER, "Buy milk", [item()]);
    const { client } = fakeClient([
      { error: { code: "23505", message: "duplicate key value" } },
    ]);

    const { synced } = await flushOutbox(client, USER);

    expect(synced).toHaveLength(1);
    expect(readOutbox(USER)).toEqual([]);
  });

  it("also sends a capture taken while a sync is already running", async () => {
    enqueueCapture(USER, "First", [item({ title: "First" })]);
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const calls: string[] = [];
    const client = {
      from: () => ({
        insert: async (row: Record<string, unknown>) => {
          calls.push(row.title as string);
          if (calls.length === 1) await gate;
          return { error: null };
        },
      }),
    } as unknown as SupabaseClient<Database>;

    const run = flushOutbox(client, USER);
    enqueueCapture(USER, "Second", [item({ title: "Second" })]);
    // A second call joins the running sync instead of starting another.
    expect(flushOutbox(client, USER)).toBe(run);
    release();
    await run;

    expect(calls).toEqual(["First", "Second"]);
    expect(readOutbox(USER)).toEqual([]);
  });

  it("stays usable when storage is unavailable", async () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    try {
      enqueueCapture(USER, "Buy milk", [item()]);
      expect(readOutbox(USER)).toEqual([
        expect.objectContaining({ text: "Buy milk" }),
      ]);
    } finally {
      setItem.mockRestore();
    }
  });
});
