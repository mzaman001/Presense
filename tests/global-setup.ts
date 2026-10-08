import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadEnv, SEED_FILE } from "./seed";

// Seeds the test account once per run (see tests/seed.ts).
//
// No service-role key (CI, a contributor without .env.local): nothing is
// written and the specs that need the account skip. With a key, a failed
// seed fails the run: that's a real breakage, not a missing setup.
export default function globalSetup() {
  fs.rmSync(SEED_FILE, { force: true });
  const env = loadEnv();
  if (!env.SUPABASE_SERVICE_ROLE_KEY) return;

  const out = execFileSync(
    process.execPath,
    [path.join(process.cwd(), "scripts", "seed-test-user.mjs"), "--json"],
    { encoding: "utf8", timeout: 60000 },
  );
  JSON.parse(out); // fail here, not in every spec, if the output is wrong
  fs.mkdirSync(path.dirname(SEED_FILE), { recursive: true });
  fs.writeFileSync(SEED_FILE, out);
}
