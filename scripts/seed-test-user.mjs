#!/usr/bin/env node
// TOOL-18: idempotent seed for the authed-measurement test account.
//
// Upserts perf-test@presense.app (confirmed email, known password), signs in
// with a password grant, and prints a session-cookie header that Playwright
// and Lighthouse can inject to reach authed routes (the app's UI only exposes
// magic-link / Google, so a UI-driven login is not reproducible in CI).
//
// Usage:
//   node scripts/seed-test-user.mjs [--cookie] [--json]
//   --cookie  print "sb-<ref>-auth-token=<value>" (for Lighthouse --extra-headers)
//   --json    print the full session object
//
// Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
//      SUPABASE_SERVICE_ROLE_KEY, TEST_ACCOUNT_EMAIL, TEST_ACCOUNT_PASSWORD
// (loaded from .env.local when unset; defaults below match the committed
// workflow, override in .env.local for a different project).

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");

const DEFAULT_EMAIL = "perf-test@presense.app";
const DEFAULT_PASSWORD = "presense-perf-test-2026!";

function loadEnvLocal() {
  const out = {};
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
  return out;
}

function base64url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

async function main() {
  const localEnv = loadEnvLocal();
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    localEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || localEnv.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.TEST_ACCOUNT_EMAIL || DEFAULT_EMAIL;
  const password = process.env.TEST_ACCOUNT_PASSWORD || DEFAULT_PASSWORD;

  if (!url || !anonKey || !serviceKey) {
    console.error(
      "Missing env: NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY (.env.local or process env)",
    );
    process.exit(1);
  }

  const ref = url.replace(/^https?:\/\//, "").split(".")[0];
  const cookieName = `sb-${ref}-auth-token`;

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const existing = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let found = (existing.data?.users ?? []).find((u) => u.email === email);

  if (found) {
    // Keep the known password deterministic so the seed is idempotent.
    const upd = await admin.auth.admin.updateUserById(found.id, { password });
    if (upd.error) {
      console.error("updateUserById failed:", upd.error.message);
      process.exit(1);
    }
  } else {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { test_account: true },
    });
    if (created.error) {
      console.error("createUser failed:", created.error.message);
      process.exit(1);
    }
  }

  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("signInWithPassword failed:", error.message);
    process.exit(1);
  }

  const session = data.session;

  // Mark onboarding complete so authed routes render instead of redirecting
  // to /onboarding (app/(app)/layout.tsx gates on user_settings).
  const upsert = await admin
    .from("user_settings")
    .upsert(
      {
        user_id: session.user.id,
        onboarding_complete: true,
        default_view: "do",
        theme: "warm",
        timezone: "UTC",
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (upsert.error) {
    console.error("user_settings upsert failed:", upsert.error.message);
    process.exit(1);
  }

  const cookieValue = `base64-${base64url(JSON.stringify(session))}`;

  const flag = process.argv[2];
  if (flag === "--json") {
    process.stdout.write(JSON.stringify({ cookieName, cookieValue, session }, null, 2) + "\n");
  } else if (flag === "--cookie") {
    process.stdout.write(`${cookieName}=${cookieValue}\n`);
  } else {
    process.stdout.write(`seeded ${email} (${session.user.id})\n${cookieName}=${cookieValue}\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
