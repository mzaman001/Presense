"use server";

import { createClient } from "@/lib/supabase-server";
import { getAuthCallbackUrl } from "@/lib/auth-redirect";
import { checkRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

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
  // Supabase intentionally does not reveal whether an address has an account.
  // Preserve that guarantee even when an upstream provider rejects delivery.
  if (error)
    return { error: null as string | null, message: MAGIC_LINK_SENT_MESSAGE };
  return { error: null as string | null, message: MAGIC_LINK_SENT_MESSAGE };
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
