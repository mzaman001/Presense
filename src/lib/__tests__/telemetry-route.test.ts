import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCaptureMessage = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureMessage: mockCaptureMessage,
}));

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
      }),
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(consoleWarn).toHaveBeenCalledWith(
      "[telemetry]",
      expect.objectContaining({
        kind: "client-error",
        message: "boom",
        path: "/login",
      }),
    );
  });

  it("forwards client-error payloads to Sentry at error level with context", async () => {
    const { POST } = await import("@/app/api/telemetry/route");

    const response = await POST(
      new Request("http://localhost/api/telemetry", {
        method: "POST",
        body: JSON.stringify({
          kind: "client-error",
          message: "boom",
          stack: "Error: boom\n    at test",
          source: "https://app.test/chunk.js",
          path: "/think",
        }),
      }),
    );

    expect(response.status).toBe(204);
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      "boom",
      expect.objectContaining({
        level: "error",
        extra: expect.objectContaining({
          telemetrySource: "client-error",
          stack: "Error: boom\n    at test",
          source: "https://app.test/chunk.js",
          path: "/think",
        }),
      }),
    );
  });

  it("forwards web-vital payloads to Sentry at info level with value", async () => {
    const { POST } = await import("@/app/api/telemetry/route");

    const response = await POST(
      new Request("http://localhost/api/telemetry", {
        method: "POST",
        body: JSON.stringify({
          kind: "web-vital",
          name: "LCP",
          value: 1234.5,
          rating: "good",
          path: "/do",
        }),
      }),
    );

    expect(response.status).toBe(204);
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      "LCP",
      expect.objectContaining({
        level: "info",
        extra: expect.objectContaining({
          telemetrySource: "web-vital",
          value: 1234.5,
          rating: "good",
          path: "/do",
        }),
      }),
    );
  });

  it("rejects malformed payloads without forwarding to Sentry", async () => {
    const { POST } = await import("@/app/api/telemetry/route");

    const response = await POST(
      new Request("http://localhost/api/telemetry", {
        method: "POST",
        body: JSON.stringify({ kind: "unknown" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON without forwarding to Sentry", async () => {
    const { POST } = await import("@/app/api/telemetry/route");

    const response = await POST(
      new Request("http://localhost/api/telemetry", {
        method: "POST",
        body: "{not json",
      }),
    );

    expect(response.status).toBe(400);
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });
});
