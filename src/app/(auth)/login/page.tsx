"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { Globe2, Mail, Loader2, Sparkles, ArrowRight } from "lucide-react";
import { OnboardingBackground, PresenseLogo } from "@/components/layout/OnboardingBackground";
import { getAuthCallbackUrl } from "@/lib/auth-redirect";

export default function LoginPage() {
  const [supabase] = useState<ReturnType<typeof createClient> | null>(() => {
    try { return createClient(); } catch { return null; }
  });

  const [email, setEmail]         = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading]     = useState<"google" | "email" | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [initError] = useState<string | null>(() =>
    supabase ? null : "Supabase failed to initialize. Restart the dev server after adding .env.local."
  );

  const handleGoogle = async () => {
    if (!supabase) return setError("Supabase not initialized. Check environment variables.");
    setLoading("google"); setError(null);
    try {
      const redirectTo = getAuthCallbackUrl(window.location.href);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) { setError(error.message); setLoading(null); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start Google sign-in");
      setLoading(null);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return setError("Supabase not initialized. Check environment variables.");
    if (!email.trim()) return;
    setLoading("email"); setError(null);
    try {
      const emailRedirectTo = getAuthCallbackUrl(window.location.href);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo },
      });
      if (error) setError(error.message);
      else setEmailSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send magic link");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Atmospheric background */}
      <OnboardingBackground phase={1} />

      {/* Centred glass card */}
      <div
        className="relative z-10 w-full max-w-[400px] rounded-[var(--radius-xl)] p-8"
        style={{
          background: "var(--surface-modal)",
          backdropFilter: "blur(32px)",
          border: "0.5px solid var(--border-strong)",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        {/* Init error */}
        {initError && (
          <div className="mb-5 p-3 rounded-[var(--radius-md)] text-sm font-medium"
            style={{ background: "var(--status-danger-dim)", border: "0.5px solid var(--status-danger-border)", color: "var(--status-danger)" }}>
            {initError}
          </div>
        )}

        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <PresenseLogo size={28} />
          <span className="text-[17px] font-semibold tracking-tight" style={{ color: "var(--text-1)" }}>Presense</span>
        </div>

        {emailSent ? (
          /* Email sent state */
          <div className="text-center py-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: "rgba(45,212,191,0.10)", border: "0.5px solid rgba(45,212,191,0.25)" }}
            >
              <Mail size={22} strokeWidth={1.5} className="text-[#2DD4BF]" />
            </div>
            <p className="text-[16px] font-semibold mb-2" style={{ color: "var(--text-1)" }}>Check your inbox</p>
            <p className="text-[13px]" style={{ color: "var(--text-3)" }}>
              We sent a magic link to <span style={{ color: "var(--text-2)" }}>{email}</span>
            </p>
            <button
              onClick={() => setEmailSent(false)}
              className="mt-6 text-[12px] underline underline-offset-2"
              style={{ color: "var(--accent-text)" }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            {/* Heading */}
            <div className="mb-7">
              <h1 className="text-[22px] font-semibold tracking-tight mb-1" style={{ color: "var(--text-1)" }}>Sign in</h1>
              <p className="text-[13px]" style={{ color: "var(--text-3)" }}>Welcome back, second brain.</p>
            </div>

            {/* Email form */}
            <form onSubmit={handleMagicLink} className="space-y-3 mb-4">
              <input
                type="email"
                name="email"
                id="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                suppressHydrationWarning
                className="input w-full"
              />
              <div className="flex justify-end">
                <span className="text-[12px]" style={{ color: "var(--accent-text)" }}>Magic link &#x2014; no password needed</span>
              </div>
              <button
                type="submit"
                disabled={!!loading || !email.trim()}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading === "email"
                  ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
                  : <Sparkles size={14} strokeWidth={1.5} />
                }
                Send sign-in link
                <ArrowRight size={14} strokeWidth={1.5} className="ml-auto" />
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px" style={{ background: "var(--border-subtle)" }} />
              <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "var(--text-4)" }}>or</span>
              <div className="flex-1 h-px" style={{ background: "var(--border-subtle)" }} />
            </div>

            {/* Google */}
            <button
              onClick={handleGoogle}
              disabled={!!loading}
              className="btn-secondary w-full flex items-center justify-center gap-2.5"
            >
              {loading === "google"
                ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
                : <Globe2 size={14} strokeWidth={1.5} />
              }
              Continue with Google
            </button>

            {/* Error */}
            {error && (
              <p className="mt-4 text-[13px] text-center p-3 rounded-[var(--radius-md)]"
                style={{ background: "var(--status-danger-dim)", border: "0.5px solid var(--status-danger-border)", color: "var(--status-danger)" }}>
                {error}
              </p>
            )}

          </>
        )}
      </div>
    </div>
  );
}
