#!/usr/bin/env node
// TOOL-18: idempotent seed for the authed-measurement test account.
//
// Upserts perf-test@presense.app (confirmed email), mints a session for it
// server-side, and prints a session-cookie header that Playwright and
// Lighthouse can inject to reach authed routes (the app's UI only exposes
// Google sign-in, so a UI-driven login is not reproducible in CI).
//
// The session comes from the Admin API: generateLink (service role) returns a
// one-time magic-link token hash, and verifyOtp exchanges it for a session.
// Nothing is emailed, and it works with the Email provider disabled, which it
// is (2026-10-02): password and self-service OTP sign-in both answer "Email
// logins are disabled", so no public sign-in path is opened. The account has
// no usable password: each run overwrites it with a random one, so a password
// once committed here can't sign in even if email logins come back.
//
// Usage:
//   node scripts/seed-test-user.mjs [--cookie] [--json] [--rituals-done]
//   --cookie        print "sb-<ref>-auth-token=<value>" (for Lighthouse --extra-headers)
//   --json          print the full session object
//   --rituals-done  mark today's morning and evening rituals done (this
//                   machine's date), so no ritual opens over the page being
//                   measured. Without it both are cleared: a ritual is due
//                   whenever the time of day allows one.
//
// Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
//      SUPABASE_SERVICE_ROLE_KEY, TEST_ACCOUNT_EMAIL
// (loaded from .env.local when unset; defaults below match the committed
// workflow, override in .env.local for a different project).

import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");

const DEFAULT_EMAIL = "perf-test@presense.app";

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
  // Never used to sign in; it only replaces any password the account had.
  const password = randomBytes(32).toString("base64url");

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
    // Scrub any earlier known password (this script used to commit one).
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

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) {
    console.error("generateLink failed:", link.error.message);
    process.exit(1);
  }

  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await anon.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: "magiclink",
  });
  if (error || !data.session) {
    console.error("verifyOtp failed:", error?.message ?? "no session returned");
    process.exit(1);
  }

  const session = data.session;

  const ritualsDone = process.argv.includes("--rituals-done");
  // The app compares these with the browser's local date (lib/rituals.ts);
  // the measuring browser runs on this machine.
  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

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
        // This machine's zone, as automatic timezone would save it, so a
        // measured load doesn't include the app correcting it.
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezone_auto: true,
        last_ritual_date: ritualsDone ? today : null,
        last_evening_ritual_date: ritualsDone ? today : null,
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (upsert.error) {
    console.error("user_settings upsert failed:", upsert.error.message);
    process.exit(1);
  }

  const cookieValue = `base64-${base64url(JSON.stringify(session))}`;

  const flag = process.argv.find((arg) => arg === "--json" || arg === "--cookie");
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
