import { describe, it, expect } from "vitest";
import { extractMentions } from "@/lib/utils";

describe("extractMentions utility", () => {
  it("returns empty array for text with no mentions", () => {
    expect(extractMentions("Hello world, no mentions here.")).toEqual([]);
  });

  it("extracts a single mention UUID", () => {
    const text = "Call @[John Doe](123e4567-e89b-12d3-a456-426614174000) tomorrow.";
    expect(extractMentions(text)).toEqual(["123e4567-e89b-12d3-a456-426614174000"]);
  });

  it("extracts multiple mention UUIDs", () => {
    const text = "Meeting with @[Alice](11111111-2222-3333-4444-555555555555) and @[Bob](66666666-7777-8888-9999-000000000000).";
    expect(extractMentions(text)).toEqual([
      "11111111-2222-3333-4444-555555555555",
      "66666666-7777-8888-9999-000000000000",
    ]);
  });

  it("handles names with spaces and hyphens", () => {
    const text = "With @[Sarah Jenkins-Smith](aaaabbbb-cccc-dddd-eeee-ffff00001111).";
    expect(extractMentions(text)).toEqual(["aaaabbbb-cccc-dddd-eeee-ffff00001111"]);
  });

  it("filters out non-UUID mention IDs", () => {
    const text = "@[Alice](not-a-uuid) and @[Bob](123e4567-e89b-12d3-a456-426614174000)";
    expect(extractMentions(text)).toEqual(["123e4567-e89b-12d3-a456-426614174000"]);
  });
});
