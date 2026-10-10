import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const init = vi.fn();
vi.mock("@sentry/nextjs", () => ({ init }));

// The server and edge inits must keep Sentry 11's wider default collection
// off too: on the server, cookies include the Supabase session and request
// bodies hold users' tasks.
describe.each([
  ["server", () => import("@/sentry.server.config")],
  ["edge", () => import("@/sentry.edge.config")],
])("sentry.%s.config", (_name, load) => {
  beforeEach(() => {
    init.mockClear();
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("collects no cookies, bodies or user info", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://key@o0.ingest.sentry.io/1");
    await load();
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({
        attachStacktrace: false,
        dataCollection: expect.objectContaining({
          userInfo: false,
          cookies: false,
          httpBodies: [],
          databaseQueryData: false,
        }),
      }),
    );
  });

  it("does nothing without a DSN", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    await load();
    expect(init).not.toHaveBeenCalled();
  });
});
