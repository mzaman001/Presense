import { describe, it, expect } from "vitest";
import { logFields } from "@/lib/logger";

// pino serialises an Error inside an array as {}, so every
// logger.error("label", err) reached the server logs as "args":[{}]:
// no message, no stack. The first Error now goes under `err`, which pino's
// error serializer understands.
describe("logFields", () => {
  it("puts the first Error under err and keeps the rest in args", () => {
    const boom = new Error("boom");
    const fields = logFields([boom, { table: "items" }]);
    expect(fields.err).toBe(boom);
    expect(fields.args).toEqual([{ table: "items" }]);
  });

  it("leaves args alone when there is no Error", () => {
    expect(logFields(["a", 1])).toEqual({ args: ["a", 1] });
  });

  it("omits args when nothing else was passed", () => {
    expect(logFields([new Error("x")])).not.toHaveProperty("args");
  });
});
