import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as Sentry from "@sentry/nextjs";

vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

const redisConstructor = vi.fn();

interface RatelimitInit {
  redis: unknown;
  limiter: unknown;
  analytics: boolean;
  prefix: string;
}

const ratelimitInits: RatelimitInit[] = [];

const limitImpl = vi.fn(async (_key: string) => ({ success: true }));

class MockRatelimit {
  static slidingWindow = vi.fn(() => ({ type: "sliding-window" }));
  limit = vi.fn((key: string) => limitImpl(key));
  constructor(init: RatelimitInit) {
    ratelimitInits.push(init);
  }
}

vi.mock("@upstash/redis", () => ({
  Redis: redisConstructor,
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: MockRatelimit,
}));

const REDIS_ENV_KEYS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_KV_REST_API_URL",
  "UPSTASH_REDIS_KV_REST_API_TOKEN",
] as const;

beforeEach(() => {
  vi.useRealTimers();
  for (const key of REDIS_ENV_KEYS) delete process.env[key];
  vi.stubEnv("NODE_ENV", "development");
  vi.clearAllMocks();
  limitImpl.mockImplementation(async () => ({ success: true }));
  ratelimitInits.length = 0;
});

describe("rate-limit lazy initialization", () => {
  it("does not initialize Upstash clients at module import time", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";

    await import("@/lib/rate-limit");

    expect(redisConstructor).not.toHaveBeenCalled();
    expect(MockRatelimit.slidingWindow).not.toHaveBeenCalled();
    expect(ratelimitInits).toHaveLength(0);
  });
});

describe("in-memory fallback (no Redis env)", () => {
  it("rejects the 4th account request within a minute", async () => {
    vi.useFakeTimers();
    const { checkRateLimit } = await import("@/lib/rate-limit");

    expect(await checkRateLimit("mem-account", "u1", 3, 60_000)).toBe(true);
    expect(await checkRateLimit("mem-account", "u1", 3, 60_000)).toBe(true);
    expect(await checkRateLimit("mem-account", "u1", 3, 60_000)).toBe(true);
    expect(await checkRateLimit("mem-account", "u1", 3, 60_000)).toBe(false);
  });

  it("does not share counters across buckets", async () => {
    vi.useFakeTimers();
    const { checkRateLimit } = await import("@/lib/rate-limit");

    await checkRateLimit("mem-account", "u1", 3, 60_000);
    await checkRateLimit("mem-account", "u1", 3, 60_000);
    await checkRateLimit("mem-account", "u1", 3, 60_000);
    expect(await checkRateLimit("mem-account", "u1", 3, 60_000)).toBe(false);

    expect(await checkRateLimit("mem-capture", "u1", 100, 60_000)).toBe(true);
    expect(await checkRateLimit("mem-capture", "u1", 100, 60_000)).toBe(true);
  });

  it("allows the request again after the window expires", async () => {
    vi.useFakeTimers();
    const { checkRateLimit } = await import("@/lib/rate-limit");

    await checkRateLimit("mem-account", "u1", 3, 60_000);
    await checkRateLimit("mem-account", "u1", 3, 60_000);
    await checkRateLimit("mem-account", "u1", 3, 60_000);
    expect(await checkRateLimit("mem-account", "u1", 3, 60_000)).toBe(false);

    vi.advanceTimersByTime(60_000);
    expect(await checkRateLimit("mem-account", "u1", 3, 60_000)).toBe(true);
  });

  it("fails closed in production without Redis", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { checkRateLimit } = await import("@/lib/rate-limit");

    expect(await checkRateLimit("mem-account", "u1", 3, 60_000)).toBe(false);
  });

  it("rejects the 4th account request and isolates per-limit counters (SEC-01)", async () => {
    // SEC-01 AC: a 4th account-delete request within a minute is rejected,
    // and the counter keys on `${bucket}:${key}:${maxRequests}:${windowMs}`
    // — the same keying the Redis path now uses — so a second call site with
    // different params never shares the account route's quota.
    vi.useFakeTimers();
    const { checkRateLimit } = await import("@/lib/rate-limit");
    for (let i = 0; i < 3; i++) {
      expect(await checkRateLimit("account", "u1", 3, 60_000)).toBe(true);
    }
    expect(await checkRateLimit("account", "u1", 3, 60_000)).toBe(false);
    expect(await checkRateLimit("account", "u1", 30, 60_000)).toBe(true);
    expect(await checkRateLimit("account", "u1", 30, 60_000)).toBe(true);
    vi.useRealTimers();
  });
});

// TOOL-08 (Aug 17, 2026): with no Redis env vars in a production runtime,
// the old code failed open silently. Now it reports an error-level Sentry
// event — this test pins that contract.
describe("production fallback when Redis env vars are absent", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports an error-level Sentry event, never fails open silently", async () => {
    vi.stubEnv("NODE_ENV", "production");
    // Fresh module graph: the earlier "fails closed in production" test ran
    // against the same cached module and already consumed the one-shot
    // redisWarned window. Resetting guarantees this test observes the report.
    vi.resetModules();
    const { checkRateLimit } = await import("@/lib/rate-limit");

    // checkRateLimit resolves false (fail closed) but must ALSO report the
    // misconfiguration to Sentry.
    const result = await checkRateLimit("account", "u", 3, 60_000);
    expect(result).toBe(false);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining("rate limiting DISABLED"),
      expect.objectContaining({ level: "error" }),
    );
  });
});

describe("Redis-backed path (env configured, modules mocked)", () => {
  it("constructs a per-bucket limiter honoring the call-site limits", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    const { checkRateLimit } = await import("@/lib/rate-limit");

    expect(await checkRateLimit("account", "u1", 3, 60_000)).toBe(true);
    expect(await checkRateLimit("account", "u1", 3, 60_000)).toBe(true);

    expect(MockRatelimit.slidingWindow).toHaveBeenCalledWith(3, "60 s");
    const accountInits = ratelimitInits.filter(
      (i) => i.prefix === "rl:account",
    );
    expect(accountInits).toHaveLength(1);
    expect(accountInits[0].analytics).toBe(true);
    expect(accountInits[0].limiter).toEqual({ type: "sliding-window" });
  });

  it("constructs a separate limiter per bucket with its own limits and prefix", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    const { checkRateLimit } = await import("@/lib/rate-limit");

    expect(await checkRateLimit("capture", "u1", 100, 60_000)).toBe(true);

    expect(MockRatelimit.slidingWindow).toHaveBeenCalledWith(100, "60 s");
    const captureInits = ratelimitInits.filter(
      (i) => i.prefix === "rl:capture",
    );
    expect(captureInits).toHaveLength(1);
    expect(ratelimitInits.some((i) => i.prefix === "rl:account")).toBe(false);
  });
});

// Production DELETE /api/account returned 500 (Sep 2026): a hand-entered
// UPSTASH_REDIS_REST_URL was not an https URL, so `new Redis()` threw
// UrlError before the route did anything. The Vercel Upstash integration's
// own variables (UPSTASH_REDIS_KV_REST_API_*) were valid but never read.
describe("Redis env resolution", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the Vercel integration's variables when the manual URL is malformed", async () => {
    process.env.UPSTASH_REDIS_REST_URL = '"https://pasted-with-quotes"';
    process.env.UPSTASH_REDIS_REST_TOKEN = "manual-token";
    process.env.UPSTASH_REDIS_KV_REST_API_URL =
      "https://integration.upstash.io";
    process.env.UPSTASH_REDIS_KV_REST_API_TOKEN = "integration-token";
    vi.resetModules();
    const { checkRateLimit } = await import("@/lib/rate-limit");

    expect(await checkRateLimit("resolve-a", "u1", 3, 60_000)).toBe(true);
    // URL and token must come from the same source, never mixed.
    expect(redisConstructor).toHaveBeenCalledWith({
      url: "https://integration.upstash.io",
      token: "integration-token",
    });
  });

  it("rejects instead of throwing when no source has a valid URL", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.UPSTASH_REDIS_REST_URL = "redis://not-rest";
    process.env.UPSTASH_REDIS_REST_TOKEN = "manual-token";
    vi.resetModules();
    const { checkRateLimit } = await import("@/lib/rate-limit");

    await expect(checkRateLimit("resolve-b", "u1", 3, 60_000)).resolves.toBe(
      false,
    );
    expect(redisConstructor).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining("UPSTASH_REDIS_REST_URL"),
      expect.objectContaining({ level: "error" }),
    );
  });
});

// Preview sign-in returned 500 (Sep 2026): the Upstash integration's host
// no longer resolved (getaddrinfo ENOTFOUND), limiter.limit() rejected, and
// the magic-link server action threw. An unreachable Redis must degrade to
// the per-instance limiter, not take the route down.
describe("Redis unreachable at request time", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to the in-memory limiter and reports once", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.UPSTASH_REDIS_REST_URL = "https://gone.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    limitImpl.mockRejectedValue(new TypeError("fetch failed"));
    vi.resetModules();
    const { checkRateLimit } = await import("@/lib/rate-limit");

    expect(await checkRateLimit("unreachable", "u1", 2, 60_000)).toBe(true);
    expect(await checkRateLimit("unreachable", "u1", 2, 60_000)).toBe(true);
    // Still limited, per instance.
    expect(await checkRateLimit("unreachable", "u1", 2, 60_000)).toBe(false);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});
