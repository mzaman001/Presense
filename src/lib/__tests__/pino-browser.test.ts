import { afterEach, describe, expect, it, vi } from "vitest";
import pino from "@/lib/pino-browser";

// The browser bundle's "pino" (next.config.ts aliases it). It must log the
// same way logger.ts's calls did with real pino's browser build.
describe("pino-browser", () => {
  afterEach(() => vi.restoreAllMocks());

  const options = {
    level: "info",
    browser: { asObject: true },
    formatters: { level: (label: string) => ({ level: label.toUpperCase() }) },
    base: { env: "test" },
  };

  it("logs one object with the level, base fields, the fields and the message", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("boom");
    pino(options).error({ err, args: [1] }, "Save failed");
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toEqual({
      level: "ERROR",
      time: expect.any(Number),
      env: "test",
      err,
      args: [1],
      msg: "Save failed",
    });
  });

  it("sends each level to the matching console method", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = pino(options);
    log.info({}, "hello");
    log.warn({}, "careful");
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "hello", level: "INFO" }),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "careful", level: "WARN" }),
    );
  });

  it("drops levels below the configured one", () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    pino(options).debug({}, "noise");
    expect(debug).not.toHaveBeenCalled();
    pino({ ...options, level: "debug" }).debug({}, "detail");
    expect(debug).toHaveBeenCalledTimes(1);
  });

  it("accepts a message without fields", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    pino(options).info("just text");
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ msg: "just text" }),
    );
  });
});
