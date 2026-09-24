/**
 * The public Supabase settings for code that runs in the browser.
 *
 * lib/env.ts validates with zod through @t3-oss/env-nextjs; importing it from
 * the browser Supabase client put zod (~22 KiB gz) in every signed-in page's
 * initial JavaScript just to check two strings. Same contract here without
 * the dependency: a missing value is logged in production and read as "",
 * never thrown (AGENTS.md invariant 1). Each variable is written out in full
 * so Next.js can inline it at build time.
 */
function required(name: string, value: string | undefined): string {
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    console.error(`[env] Missing required environment variable: ${name}`);
  }
  return "";
}

export const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
};
