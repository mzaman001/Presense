function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `[env] Missing required environment variable: ${name}. ` +
      `Copy .env.example to .env.local and fill in the values.`
    );
  }
  return v;
}

export const env = {
  get NEXT_PUBLIC_SUPABASE_URL() { return required('NEXT_PUBLIC_SUPABASE_URL'); },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY() { return required('NEXT_PUBLIC_SUPABASE_ANON_KEY'); },
  get SUPABASE_SERVICE_ROLE_KEY() { return process.env.SUPABASE_SERVICE_ROLE_KEY; },
  get UPSTASH_REDIS_REST_URL() { return process.env.UPSTASH_REDIS_REST_URL; },
  get UPSTASH_REDIS_REST_TOKEN() { return process.env.UPSTASH_REDIS_REST_TOKEN; },
};
