import { describe, expect, it, vi, beforeEach } from "vitest";

const redisConstructor = vi.fn();

interface RatelimitInit {
  redis: unknown;
  limiter: unknown;
  analytics: boolean;
  prefix: string;
}

const ratelimitInits: RatelimitInit[] = [];

class MockRatelimit {
  static slidingWindow = vi.fn(() => ({ type: "sliding-window" }));
  limit = vi.fn(async () => ({ success: true }));
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
] as const;

beforeEach(() => {
  vi.useRealTimers();
  for (const key of REDIS_ENV_KEYS) delete process.env[key];
  vi.stubEnv("NODE_ENV", "development");
  vi.clearAllMocks();
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
