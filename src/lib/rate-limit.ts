import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redisEnvAvailable =
  !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
  !!(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN);

const redis = redisEnvAvailable
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL!,
      token:
        process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN!,
    })
  : null;

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "60 s"),
      analytics: true,
      prefix: "rl:capture",
    })
  : null;

// Fallback: in-memory when Redis is not configured (local dev only)
const memMap = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(
  key: string,
  maxRequests = 100,
  windowMs = 60_000
): Promise<boolean> {
  if (ratelimit) {
    const { success } = await ratelimit.limit(key);
    return success;
  }

  // In-memory fallback
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
