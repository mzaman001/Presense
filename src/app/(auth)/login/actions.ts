"use server";

import { createClient } from "@/lib/supabase-server";
import { getAuthCallbackUrl } from "@/lib/auth-redirect";
import { checkRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import * as Sentry from "@sentry/nextjs";

const MAGIC_LINK_SENT_MESSAGE =
  "If an account exists for this email, a sign-in link has been sent.";

function getRequestIp(requestHeaders: Headers) {
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown"
  );
}

// PERF-10a: run login's auth calls server-side so supabase-js + zod never
// enter the public-route client bundle (chunk 5967, ~77.8 KiB gz).
// PKCE verifier is written to cookies by @supabase/ssr either way, so
// /auth/callback's exchangeCodeForSession keeps working unchanged.

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const origin = String(formData.get("origin") ?? "").trim();
  if (!email) return { error: "Please enter your email address." };

  const requestHeaders = await headers();
  const ip = getRequestIp(requestHeaders);
  if (!(await checkRateLimit("magic-link", `${email}|${ip}`, 3, 60_000))) {
    return {
      error: "Too many sign-in attempts. Please wait a minute and try again.",
    };
  }

  // SEC2-02/SEC2-03 (2026-08-16): forward the Turnstile challenge token when the
  // client widget supplied one. GoTrue rejects signInWithOtp with `captcha_failed`
  // when captcha enforcement is enabled and no token is present; a missing token
  // (sitekey not configured) is fine while the backend toggle is still off.
  const captchaToken =
    String(formData.get("cf-turnstile-response") ?? "").trim() || undefined;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: getAuthCallbackUrl(origin),
      ...(captchaToken ? { captchaToken } : {}),
    },
  });
  // Supabase intentionally does not reveal whether an address has an account,
  // so the caller always gets the same message. That is a deliberate
  // anti-enumeration choice about what the *user* sees — it should not also
  // hide a broken mail provider from us, which is what dropping the error
  // entirely did. Report it, answer generically.
  if (error) {
    Sentry.captureException(error, { tags: { action: "sendMagicLink" } });
  }
  return { error: null as string | null, message: MAGIC_LINK_SENT_MESSAGE };
}

// The sign-in email carries a code as well as the link. The link only works in
// the browser that asked for it (its PKCE verifier lives in that browser's
// cookies), so it fails when opened on another device or in a mail app's
// built-in browser. Typing the code into the screen that asked works anywhere.
export async function verifyEmailCode(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  // Supabase codes are 6 digits by default (the project can raise it to 10).
  const code = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!email || !/^\d{6,10}$/.test(code)) {
    return { error: "Enter the code from the email." };
  }

  // Keyed by email alone: per-IP limits would let a botnet guess a code.
  if (!(await checkRateLimit("email-code", email, 5, 600_000))) {
    return { error: "Too many attempts. Request a new code in a few minutes." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "email",
  });
  if (error) {
    return {
      error:
        "That code is wrong or has expired. Check the latest email, or request a new one.",
    };
  }
  return { error: null as string | null };
}

export async function startGoogleSignIn(formData: FormData) {
  const origin = String(formData.get("origin") ?? "").trim();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: getAuthCallbackUrl(origin) },
  });
  if (error) return { error: error.message };
  if (!data.url) return { error: "Failed to start Google sign-in." };
  return { url: data.url, error: null as string | null };
}
