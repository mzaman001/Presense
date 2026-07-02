// src/lib/env.ts — safe version that does NOT throw on every request
// Validates at startup (module load) only in production, never in middleware hot path

const requiredEnvVars = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];

// One-time startup check — logs warning, does NOT throw
if (process.env.NODE_ENV === 'production') {
  for (const name of requiredEnvVars) {
    if (!process.env[name]) {
      console.error(`[env] Missing required environment variable: ${name}`);
    }
  }
}

// Export simple accessors — return the value or empty string, NEVER throw
export const env = {
  get NEXT_PUBLIC_SUPABASE_URL() { return process.env.NEXT_PUBLIC_SUPABASE_URL || ''; },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY() { return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''; },
  get SUPABASE_SERVICE_ROLE_KEY() { return process.env.SUPABASE_SERVICE_ROLE_KEY || ''; },
  get UPSTASH_REDIS_REST_URL() { return process.env.UPSTASH_REDIS_REST_URL || ''; },
  get UPSTASH_REDIS_REST_TOKEN() { return process.env.UPSTASH_REDIS_REST_TOKEN || ''; },
};
