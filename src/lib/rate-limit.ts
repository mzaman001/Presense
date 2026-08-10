import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { logger } from "./logger";

const limiters = new Map<string, Ratelimit>();

let redisWarned = false;

function getRateLimit(bucket: string, maxRequests: number, windowMs: number) {
  const cached = limiters.get(bucket);
  if (cached) return cached;

  const redisEnvAvailable =
    !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
    !!(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN);

  if (!redisEnvAvailable) {
    if (!redisWarned && process.env.NODE_ENV === "development") {
      redisWarned = true;
      logger.warn(
        "[rate-limit] Upstash Redis not configured - rate limiting is DISABLED in dev. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for production.",
      );
    }
    return null;
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL!,
    token:
      process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN!,
  });

  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      maxRequests,
      `${windowMs / 1000} s` as Duration,
    ),
    analytics: true,
    prefix: `rl:${bucket}`,
  });

  limiters.set(bucket, ratelimit);
  return ratelimit;
}

// Fallback: in-memory when Redis is not configured (local dev only)
const memMap = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(
  bucket: string,
  key: string,
  maxRequests = 100,
  windowMs = 60_000,
): Promise<boolean> {
  const limiter = getRateLimit(bucket, maxRequests, windowMs);

  if (limiter) {
    const { success } = await limiter.limit(key);
    return success;
  }

  // Fail closed in production without Redis.
  if (process.env.NODE_ENV === "production") {
    logger.error(
      "[rate-limit] Redis not configured in production - rejecting request",
    );
    return false;
  }

  const memKey = `${bucket}:${key}`;
  const now = Date.now();
  const entry = memMap.get(memKey);

  if (!entry || now > entry.resetAt) {
    memMap.set(memKey, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) return false;

  entry.count++;
  return true;
}
