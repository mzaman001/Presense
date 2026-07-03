import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { logger } from "./logger";

let ratelimit: Ratelimit | null | undefined;

function getRateLimit() {
  if (ratelimit !== undefined) return ratelimit;

  const redisEnvAvailable =
    !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
    !!(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN);

  if (!redisEnvAvailable) {
    ratelimit = null;
    if (process.env.NODE_ENV === "development") {
      logger.warn(
        "[rate-limit] Upstash Redis not configured - rate limiting is DISABLED in dev. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for production."
      );
    }
    return ratelimit;
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN!,
  });

  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, "60 s"),
    analytics: true,
    prefix: "rl:capture",
  });

  return ratelimit;
}

// Fallback: in-memory when Redis is not configured (local dev only)
const memMap = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(
  key: string,
  maxRequests = 100,
  windowMs = 60_000
): Promise<boolean> {
  const limiter = getRateLimit();

  if (limiter) {
    const { success } = await limiter.limit(key);
    return success;
  }

  // Fail closed in production without Redis.
  if (process.env.NODE_ENV === "production") {
    logger.error("[rate-limit] Redis not configured in production - rejecting request");
    return false;
  }

  const now = Date.now();
  const entry = memMap.get(key);

  if (!entry || now > entry.resetAt) {
    memMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) return false;

  entry.count++;
  return true;
}
