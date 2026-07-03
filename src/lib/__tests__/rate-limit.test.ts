import { describe, expect, it, vi } from "vitest";

const redisConstructor = vi.fn();
const ratelimitConstructor = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: redisConstructor,
}));

vi.mock("@upstash/ratelimit", () => {
  const Ratelimit = ratelimitConstructor as typeof ratelimitConstructor & {
    slidingWindow: ReturnType<typeof vi.fn>;
  };
  Ratelimit.slidingWindow = vi.fn(() => ({ type: "sliding-window" }));
  return { Ratelimit };
});

describe("rate-limit lazy initialization", () => {
  it("does not initialize Upstash clients at module import time", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";

    await import("@/lib/rate-limit");

    expect(redisConstructor).not.toHaveBeenCalled();
    expect(ratelimitConstructor).not.toHaveBeenCalled();
  });
});
