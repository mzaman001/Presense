// src/lib/env.ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// Note: AGENTS.md invariant 1 strictly forbids throwing on missing env vars at runtime.
// The site must not crash. We validate and log errors via Zod, but catch them and return empty strings.

/**
 * Required-but-absent: loud, because the feature that needs it is broken.
 */
const logAndReturnEmpty = (name: string) => {
  if (process.env.NODE_ENV === "production") {
    console.error(`[env] Missing required environment variable: ${name}`);
  }
  return "";
};

/**
 * Optional-and-absent: silent. Sentry and Turnstile are both designed to be
 * off when unset, so reporting them as missing "required" variables filled
 * every production boot and every build with errors that were not errors —
 * which is how a real missing variable gets lost in the noise.
 */
const optional = () => "";

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z
      .string()
      .min(1)
      .catch(() => logAndReturnEmpty("SUPABASE_SERVICE_ROLE_KEY")),
    // Redis is not listed: src/lib/rate-limit.ts accepts several variable
    // names (UPSTASH_REDIS_REST_*, KV_REST_API_*, the Vercel integration's)
    // and reports a missing or broken configuration to Sentry itself.
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z
      .string()
      .min(1)
      .catch(() => logAndReturnEmpty("NEXT_PUBLIC_SUPABASE_URL")),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z
      .string()
      .min(1)
      .catch(() => logAndReturnEmpty("NEXT_PUBLIC_SUPABASE_ANON_KEY")),
    // Optional: without a DSN the Sentry SDK simply does not report.
    NEXT_PUBLIC_SENTRY_DSN: z.string().catch(optional),
    // SEC2-02/SEC2-03 (2026-08-16): Cloudflare Turnstile sitekey for auth captcha.
    // OPTIONAL — when empty, no captcha widget renders and no token is sent, matching a
    // project where backend captcha enforcement is not yet enabled. Do not make throwing.
    NEXT_PUBLIC_TURNSTILE_SITEKEY: z.string().catch(optional),
  },
  runtimeEnv: {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_TURNSTILE_SITEKEY: process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY,
  },
  emptyStringAsUndefined: true,
});
