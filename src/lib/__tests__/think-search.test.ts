import { describe, expect, it, vi } from "vitest";
import { searchThreads, snippetAround } from "@/lib/think-threads";

describe("searchThreads", () => {
  it("asks search_threads for titles and entry text, and keeps the snippet", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { id: "t1", title: "Garden plans", snippet: "tomato cages" },
        { id: "t2", title: "Tomato recipes", snippet: null },
      ],
      error: null,
    });
    const hits = await searchThreads({ rpc } as never, "tomato");
    expect(rpc).toHaveBeenCalledWith("search_threads", {
      p_query: "tomato",
      p_limit: 5,
    });
    expect(hits).toEqual([
      { id: "t1", title: "Garden plans", snippet: "tomato cages" },
      { id: "t2", title: "Tomato recipes", snippet: null },
    ]);
  });

  it("throws a failed search instead of returning nothing", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(searchThreads({ rpc } as never, "x")).rejects.toEqual({
      message: "boom",
    });
  });
});

describe("snippetAround", () => {
  it("returns short text whole, on one line", () => {
    expect(snippetAround("buy\n tomato   seeds", "tomato")).toBe(
      "buy tomato seeds",
    );
  });

  it("centres a long text on the match, with ellipses where it was cut", () => {
    const text = `${"a".repeat(100)} the tomato cages are in the shed ${"b".repeat(100)}`;
    const out = snippetAround(text, "TOMATO", 40);
    expect(out).toContain("tomato");
    expect(out.startsWith("…")).toBe(true);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(42);
  });

  it("starts at the beginning when the match isn't found", () => {
    const out = snippetAround("x".repeat(100), "zzz", 20);
    expect(out).toBe(`${"x".repeat(20)}…`);
  });
});
