"use server";

import { createClient } from "@/lib/supabase-server";
import { getAuthCallbackUrl } from "@/lib/auth-redirect";

// PERF-10a: run login's auth calls server-side so supabase-js + zod never
// enter the public-route client bundle (chunk 5967, ~77.8 KiB gz).
// PKCE verifier is written to cookies by @supabase/ssr either way, so
// /auth/callback's exchangeCodeForSession keeps working unchanged.

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const origin = String(formData.get("origin") ?? "").trim();
  if (!email) return { error: "Please enter your email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: getAuthCallbackUrl(origin) },
  });
  if (error) return { error: error.message };
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
