import { describe, it, expect, vi } from "vitest";
import { routeInboxItem } from "@/lib/inbox-route";

// Routing an inbox item to Think or Remember used to move the original to
// Trash, where it sat as a "deleted task" for 30 days. It's removed now,
// and undo puts the exact original row back.

type Call = { table: string; op: string; arg?: unknown };

function mockSupabase(opts: { deleteFails?: boolean } = {}) {
  const calls: Call[] = [];
  const original = {
    id: "i1",
    user_id: "u1",
    title: "keys are in the drawer",
    status: "inbox",
    deadline: "2026-10-09T10:00:00Z",
  };
  const from = (table: string) => {
    let op = "";
    let arg: unknown;
    const q: Record<string, unknown> = {};
    const record = (o: string, a?: unknown) => {
      op = o;
      arg = a;
      calls.push({ table, op: o, arg: a });
      return q;
    };
    q.select = () => (op ? q : record("select"));
    q.insert = (a: unknown) => record("insert", a);
    q.update = (a: unknown) => record("update", a);
    q.delete = () => record("delete");
    q.eq = () => q;
    q.single = () => q;
    q.then = (resolve: (v: unknown) => void) => {
      if (op === "select") return resolve({ data: original, error: null });
      if (op === "insert" && table !== "items")
        return resolve({ data: { id: "new1" }, error: null });
      if (op === "delete" && table === "items" && opts.deleteFails)
        return resolve({ error: { message: "nope" } });
      return resolve({ data: null, error: null });
    };
    void arg;
    return q;
  };
  return { supabase: { from } as never, calls, original };
}

const item = { id: "i1", title: "keys are in the drawer", user_id: "u1" };

describe("routeInboxItem", () => {
  it("removes the inbox row instead of trashing it, and undo restores it whole", async () => {
    const { supabase, calls, original } = mockSupabase();
    const undo = await routeInboxItem(supabase, item, "remember");

    const ops = calls.map((c) => `${c.table}.${c.op}`);
    expect(ops).toEqual(["items.select", "locations.insert", "items.delete"]);
    expect(calls.some((c) => c.op === "update" && c.table === "items")).toBe(
      false,
    );

    await undo();
    const undoCalls = calls.slice(3).map((c) => `${c.table}.${c.op}`);
    expect(undoCalls).toEqual(["items.insert", "locations.delete"]);
    expect(calls[3].arg).toEqual(original);
  });

  it("removes what it created if the inbox row can't be removed", async () => {
    const { supabase, calls } = mockSupabase({ deleteFails: true });
    await expect(routeInboxItem(supabase, item, "think")).rejects.toThrow();
    expect(calls.map((c) => `${c.table}.${c.op}`)).toEqual([
      "items.select",
      "threads.insert",
      "items.delete",
      "threads.delete",
    ]);
  });

  it("routes to Do by turning the item into a task", async () => {
    const { supabase, calls } = mockSupabase();
    await routeInboxItem(supabase, item, "do");
    expect(calls).toEqual([
      { table: "items", op: "update", arg: { status: "active" } },
    ]);
  });
});
