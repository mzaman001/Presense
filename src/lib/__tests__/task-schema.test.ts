import { describe, it, expect } from "vitest";
import { taskSchema } from "@/lib/schemas";

// The task panel writes deadlines as local "yyyy-MM-ddTHH:mm" (from its date
// picker and from parsed text). Rejecting that disabled "Add task" whenever
// a date was set, even with a valid title.
describe("taskSchema", () => {
  it.each([
    ["no deadline", ""],
    ["local panel format", "2026-09-24T21:00"],
    ["zoned ISO", "2026-09-24T21:00:00.000Z"],
  ])("accepts a title with %s", (_label, deadline) => {
    expect(
      taskSchema.safeParse({ title: "Do the work", deadline }).success,
    ).toBe(true);
  });

  it("only needs a title", () => {
    expect(taskSchema.safeParse({ title: "Do the work" }).success).toBe(true);
    expect(taskSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("still rejects a deadline that is not a date", () => {
    expect(
      taskSchema.safeParse({ title: "x", deadline: "tomorrowish" }).success,
    ).toBe(false);
  });
});
