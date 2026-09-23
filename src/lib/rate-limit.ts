import * as Sentry from "@sentry/nextjs";
import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { logger } from "./logger";

const limiters = new Map<string, Ratelimit>();

let redisWarned = false;

/**
 * SEC-01 (Aug 17, 2026): the limiter cache is keyed by the FULL call-site
 * identity (bucket + limit + window) — previously the module-level Map
 * returned a cached limiter regardless of the caller's maxRequests/windowMs,
 * so when Redis was configured every route silently shared one hardcoded
 * Ratelimit. The bucket name still drives the Redis prefix (per-site counters).
 */
function limiterKey(
  bucket: string,
  maxRequests: number,
  windowMs: number,
): string {
  return `${bucket}:${maxRequests}:${windowMs}`;
}

/** Same check `new Redis()` applies before throwing UrlError. */
const REST_URL = /^https?:\/\/[^\s#$./?].\S*$/;

/** Checked in order; URL and token are always taken from the same source. */
const REDIS_ENV_SOURCES = [
  ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
  ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
  // Names the Vercel Upstash integration injects for a store called "upstash-redis".
  ["UPSTASH_REDIS_KV_REST_API_URL", "UPSTASH_REDIS_KV_REST_API_TOKEN"],
] as const;

/**
 * A malformed URL used to reach `new Redis()`, which throws — every route
 * behind the limiter then returned 500 (production account deletion failed
 * this way). An invalid source is reported by variable name and skipped.
 */
const reportedInvalid = new Set<string>();

function resolveRedisEnv(bucket: string) {
  for (const [urlKey, tokenKey] of REDIS_ENV_SOURCES) {
    const url = process.env[urlKey];
    const token = process.env[tokenKey];
    if (!url || !token) continue;
    if (REST_URL.test(url)) return { url, token };
    if (reportedInvalid.has(urlKey)) continue;
    reportedInvalid.add(urlKey);
    Sentry.captureMessage(
      `[rate-limit] ${urlKey} is not a valid Upstash REST URL (expected https://…) — ignoring it.`,
      { level: "error", tags: { subsystem: "rate-limit" }, extra: { bucket } },
    );
  }
  return null;
}

function getRateLimit(bucket: string, maxRequests: number, windowMs: number) {
  const cached = limiters.get(limiterKey(bucket, maxRequests, windowMs));
  if (cached) return cached;

  const redisEnv = resolveRedisEnv(bucket);

  if (!redisEnv) {
    if (process.env.NODE_ENV === "production" && !redisWarned) {
      // TOOL-08 (Aug 17, 2026): a production deployment without Redis env vars
      // silently fails OPEN under the old code (getRateLimit returned null and
      // nothing reported it). A misconfigured deployment now surfaces as an
      // error-level Sentry event with the route's bucket attached, so it can
      // never be silent again.
      redisWarned = true;
      Sentry.captureMessage(
        `[rate-limit] Upstash Redis not configured in production — rate limiting DISABLED for bucket "${bucket}". Set UPSTASH_REDIS_REST_URL/TOKEN (or KV_REST_API_URL/TOKEN).`,
        {
          level: "error",
          tags: { subsystem: "rate-limit" },
          extra: { bucket, hasKvApiUrl: !!process.env.KV_REST_API_URL },
        },
      );
    }
    if (!redisWarned && process.env.NODE_ENV === "development") {
      redisWarned = true;
      logger.warn(
        "[rate-limit] Upstash Redis not configured - rate limiting is DISABLED in dev. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for production.",
      );
    }
    return null;
  }

  const redis = new Redis(redisEnv);

  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      maxRequests,
      `${windowMs / 1000} s` as Duration,
    ),
    analytics: true,
    prefix: `rl:${bucket}`,
  });

  limiters.set(limiterKey(bucket, maxRequests, windowMs), ratelimit);
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

  // SEC-01: the in-memory fallback keys on limit + window too, so it always
  // mirrors what the Redis path now does.
  const memKey = `${bucket}:${key}:${maxRequests}:${windowMs}`;
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
