import { beforeEach, describe, expect, it, vi } from "vitest";

describe("telemetry route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("accepts a bounded client error payload without echoing details", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { POST } = await import("@/app/api/telemetry/route");

    const response = await POST(
      new Request("http://localhost/api/telemetry", {
        method: "POST",
        body: JSON.stringify({
          kind: "client-error",
          message: "boom",
          stack: "Error: boom\n    at test",
          path: "/login",
        }),
      })
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(consoleWarn).toHaveBeenCalledWith(
      "[telemetry]",
      expect.objectContaining({ kind: "client-error", message: "boom", path: "/login" })
    );
  });

  it("rejects malformed payloads", async () => {
    const { POST } = await import("@/app/api/telemetry/route");

    const response = await POST(
      new Request("http://localhost/api/telemetry", {
        method: "POST",
        body: JSON.stringify({ kind: "unknown" }),
      })
    );

    expect(response.status).toBe(400);
  });
});
