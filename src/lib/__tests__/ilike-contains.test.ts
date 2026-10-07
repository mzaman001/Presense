import { describe, it, expect } from "vitest";
import { ilikeContains } from "@/lib/utils";

// A % or _ typed into search acted as a wildcard: "100%" matched nearly
// everything. They're escaped now; quoting for the or() filter still holds.
describe("ilikeContains", () => {
  it("makes LIKE wildcards in the term literal", () => {
    // Value Postgres sees after PostgREST unquotes: %100\%% and %a\_b%.
    // In the quoted filter value the LIKE escape's backslash is doubled
    // again by PostgREST quoting: \\% here reaches Postgres as \%.
    expect(ilikeContains("100%")).toBe('"%100\\\\%%"');
    expect(ilikeContains("a_b")).toBe('"%a\\\\_b%"');
  });

  it("still quotes commas, parentheses and quotes", () => {
    expect(ilikeContains('a,b(c)"d')).toBe('"%a,b(c)\\"d%"');
  });
});
