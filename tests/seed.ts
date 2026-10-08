import fs from "node:fs";
import path from "node:path";

// The seeded test account (scripts/seed-test-user.mjs), shared by every spec.
//
// global-setup.ts mints one session per run and writes it here. Each spec
// used to run the seed itself; two doing it at once invalidated each other's
// magic link ("Email link is invalid or has expired") and the loser skipped.

export const SEED_FILE = path.join(
  process.cwd(),
  "playwright",
  ".cache",
  "seed.json",
);

export type Seed = {
  cookieName: string;
  cookieValue: string;
  session: { user: { id: string } };
};

/** process.env first, then .env.local. */
export function loadEnv(): Record<string, string> {
  const out: Record<string, string> = { ...process.env } as Record<
    string,
    string
  >;
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return out;
}

/** The seeded session, or null when this run has no service-role key. */
export function readSeed(): Seed | null {
  if (!fs.existsSync(SEED_FILE)) return null;
  return JSON.parse(fs.readFileSync(SEED_FILE, "utf8")) as Seed;
}

export const NO_SEED =
  "no seeded account: SUPABASE_SERVICE_ROLE_KEY isn't set (CI, or no .env.local)";

export function seedCookie(seed: Seed) {
  return {
    name: seed.cookieName,
    value: seed.cookieValue,
    domain: "localhost",
    sameSite: "Lax" as const,
    path: "/",
  };
}
