import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    from: (table: string) => ({
      insert: (row: unknown) => {
        insert(table, row);
        return Promise.resolve({ error: null });
      },
    }),
  }),
}));

import { track, trackAppOpen } from "@/lib/track";

beforeEach(() => {
  localStorage.clear();
  insert.mockClear();
  vi.stubEnv("NODE_ENV", "production");
});
afterEach(() => vi.unstubAllEnvs());

describe("track", () => {
  it("inserts the event into product_events", () => {
    track("focus_started", { minutes: 5 });
    expect(insert).toHaveBeenCalledWith("product_events", {
      name: "focus_started",
      props: { minutes: 5 },
    });
  });

  it("records nothing outside production builds", () => {
    vi.stubEnv("NODE_ENV", "development");
    track("focus_started");
    expect(insert).not.toHaveBeenCalled();
  });

  it("never throws when the client does", () => {
    insert.mockImplementationOnce(() => {
      throw new Error("offline");
    });
    expect(() => track("app_open")).not.toThrow();
  });
});

describe("trackAppOpen", () => {
  it("records one open per device per local day", () => {
    const morning = new Date(2026, 10, 24, 8, 0);
    const evening = new Date(2026, 10, 24, 21, 0);
    const nextDay = new Date(2026, 10, 25, 7, 0);
    expect(trackAppOpen(morning)).toBe(true);
    expect(trackAppOpen(evening)).toBe(false);
    expect(trackAppOpen(nextDay)).toBe(true);
    expect(insert).toHaveBeenCalledTimes(2);
  });
});
