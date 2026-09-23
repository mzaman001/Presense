import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const init = vi.fn();
const captureException = vi.fn();
const captureRouterTransitionStart = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  init,
  captureException,
  captureRouterTransitionStart,
}));

async function freshModule(dsn: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", dsn);
  return import("../sentry-client");
}

describe("sentry-client", () => {
  beforeEach(() => {
    init.mockClear();
    captureException.mockClear();
    captureRouterTransitionStart.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is a no-op without a DSN", async () => {
    const mod = await freshModule("");
    mod.bufferEarlyErrors();
    mod.captureException(new Error("x"));
    expect(await mod.loadSentry()).toBeNull();
    expect(init).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("initialises the SDK once, however often it is loaded", async () => {
    const mod = await freshModule("https://key@o0.ingest.sentry.io/1");
    await Promise.all([mod.loadSentry(), mod.loadSentry()]);
    expect(init).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: "https://key@o0.ingest.sentry.io/1" }),
    );
  });

  it("queues captureException before load and replays it after", async () => {
    const mod = await freshModule("https://key@o0.ingest.sentry.io/1");
    const err = new Error("boundary");
    mod.captureException(err, { tags: { section: "x" } });
    expect(captureException).not.toHaveBeenCalled();
    await mod.loadSentry();
    expect(captureException).toHaveBeenCalledWith(err, {
      tags: { section: "x" },
    });
  });

  it("replays window errors thrown before the SDK loaded, then stops listening", async () => {
    // jsdom reports an error event carrying an Error as a test failure unless
    // something marks it handled.
    const handled = (e: Event) => e.preventDefault();
    window.addEventListener("error", handled);
    const mod = await freshModule("https://key@o0.ingest.sentry.io/1");
    mod.bufferEarlyErrors();
    const early = new Error("early");
    window.dispatchEvent(
      new ErrorEvent("error", {
        error: early,
        message: "early",
        cancelable: true,
      }),
    );
    const rejection = new Event("unhandledrejection") as PromiseRejectionEvent;
    Object.defineProperty(rejection, "reason", { value: "rejected" });
    window.dispatchEvent(rejection);

    await mod.loadSentry();
    expect(captureException).toHaveBeenCalledWith(
      early,
      expect.objectContaining({
        mechanism: expect.objectContaining({ handled: false }),
      }),
    );
    expect(captureException).toHaveBeenCalledWith(
      "rejected",
      expect.anything(),
    );

    // After init the SDK's own global handlers take over; the buffer must not
    // report the same event a second time.
    captureException.mockClear();
    window.dispatchEvent(
      new ErrorEvent("error", { error: new Error("late"), cancelable: true }),
    );
    expect(captureException).not.toHaveBeenCalled();
    window.removeEventListener("error", handled);
  });

  it("forwards router transitions only once loaded", async () => {
    const mod = await freshModule("https://key@o0.ingest.sentry.io/1");
    mod.onRouterTransitionStart("/do", "push");
    expect(captureRouterTransitionStart).not.toHaveBeenCalled();
    await mod.loadSentry();
    mod.onRouterTransitionStart("/do", "push");
    expect(captureRouterTransitionStart).toHaveBeenCalledWith("/do", "push");
  });
});
