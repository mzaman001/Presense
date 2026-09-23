"use client";

import { useState } from "react";
import { Globe2, Mail, Loader2, Sparkles, ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { sendMagicLink, startGoogleSignIn } from "./actions";
import { TurnstileWidget } from "@/components/features/TurnstileWidget";
import { Button } from "@/components/ui/button";
import { Icon as UiIcon } from "@/components/ui/Icon";

// SEC2-02/SEC2-03 (2026-08-16): Turnstile sitekey is OPTIONAL — when unset the
// widget renders nothing and no captcha token is sent, matching a project where
// backend captcha enforcement is not yet enabled. Do NOT enable the backend
// Turnstile secret until this wiring is deployed with a sitekey set.
//
// PERF (2026-09-15): read directly from process.env instead of importing the
// shared `env` object — `env.ts` builds one zod-validated object covering
// both server and client schemas, so importing it here (a client component)
// pulled the entire zod validation graph into this page's bundle (measured
// ~64 KiB gz). NEXT_PUBLIC_* vars are statically inlined by Next.js at build
// time, so no import or runtime validation is needed for this client-only read.
const TURNSTILE_SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY || "";
const captchaEnabled = Boolean(TURNSTILE_SITEKEY);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");

  const formDataWith = (pairs: Array<[string, string]>) => {
    const fd = new FormData();
    pairs.forEach(([k, v]) => fd.append(k, v));
    // SEC2-03: attach the Turnstile challenge token (GoTrue's expected field).
    if (captchaEnabled && captchaToken) {
      fd.append("cf-turnstile-response", captchaToken);
    }
    return fd;
  };

  const handleGoogle = async () => {
    setLoading("google");
    setError(null);
    try {
      const result = await startGoogleSignIn(
        formDataWith([["origin", window.location.origin]]),
      );
      if (result.error) setError(result.error);
      else if (result.url) window.location.href = result.url;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start Google sign-in",
      );
      setLoading(null);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading("email");
    setError(null);
    try {
      const result = await sendMagicLink(
        formDataWith([
          ["email", email],
          ["origin", window.location.origin],
        ]),
      );
      if (result.error) setError(result.error);
      else setEmailSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send magic link",
      );
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-[var(--bg-base)] p-4">
      <AmbientBackground />
      {/* Centred card on the horizon light — flat, no blur */}
      <div
        className="relative w-full max-w-[400px] rounded-[var(--radius-xl)] p-6 sm:p-8"
        style={{
          background: "var(--surface-modal)",
          border: "0.5px solid var(--border-strong)",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        {/* Mark + wordmark */}
        <div className="mb-8 flex items-center gap-2.5 text-[var(--accent)]">
          <BrandMark size={28} />
          <span className="text-title-lg font-heading font-semibold tracking-tight text-[var(--text-1)]">
            Presense
          </span>
        </div>

        {emailSent ? (
          /* Email sent state */
          <div className="py-4 text-center">
            <div
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background: "var(--status-done-dim)",
                border: "0.5px solid var(--accent-border)",
              }}
            >
              <UiIcon
                size={22}
                strokeWidth={1.5}
                className="text-[var(--status-done)]"
                icon={Mail}
              />
            </div>
            <p
              className="text-title-md mb-2 font-semibold"
              style={{ color: "var(--text-1)" }}
            >
              Check your inbox
            </p>
            <p className="text-body" style={{ color: "var(--text-3)" }}>
              We sent a magic link to{" "}
              <span style={{ color: "var(--text-2)" }}>{email}</span>
            </p>
            <button
              onClick={() => setEmailSent(false)}
              className="text-ui mt-6 underline underline-offset-2"
              style={{ color: "var(--accent-text)" }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            {/* Heading */}
            <div className="mb-7">
              <h1 className="font-heading mb-1 text-[length:var(--text-title-2xl)] font-medium tracking-[-0.01em] text-[var(--text-1)]">
                Sign in
              </h1>
              <p className="text-body" style={{ color: "var(--text-3)" }}>
                Pick up where you left off.
              </p>
            </div>

            {/* Email form */}
            <form onSubmit={handleMagicLink} className="mb-4 space-y-3">
              <label
                htmlFor="email"
                className="text-ui mb-1.5 block font-medium text-[var(--text-2)]"
              >
                Email
              </label>
              <input
                type="email"
                name="email"
                id="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                suppressHydrationWarning
                aria-describedby="email-hint"
                className="input w-full"
              />
              <p id="email-hint" className="text-meta text-[var(--text-3)]">
                We&apos;ll email you a sign-in link. No password needed.
              </p>
              {captchaEnabled && (
                <TurnstileWidget
                  sitekey={TURNSTILE_SITEKEY}
                  onTokenChange={setCaptchaToken}
                />
              )}
              <Button
                variant="primary"
                type="submit"
                disabled={
                  !!loading ||
                  !email.trim() ||
                  (captchaEnabled && !captchaToken)
                }
                className="flex w-full items-center justify-center gap-2"
              >
                {loading === "email" ? (
                  <UiIcon
                    size={16}
                    strokeWidth={1.5}
                    className="animate-spin"
                    icon={Loader2}
                  />
                ) : (
                  <UiIcon size={16} strokeWidth={1.5} icon={Sparkles} />
                )}
                Send sign-in link
                <UiIcon
                  size={16}
                  strokeWidth={1.5}
                  className="ml-auto"
                  icon={ArrowRight}
                />
              </Button>
            </form>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div
                className="h-px flex-1"
                style={{ background: "var(--border-subtle)" }}
              />
              <span
                className="text-caption font-semibold tracking-widest uppercase"
                style={{ color: "var(--text-muted)" }}
              >
                or
              </span>
              <div
                className="h-px flex-1"
                style={{ background: "var(--border-subtle)" }}
              />
            </div>

            {/* Google */}
            <Button
              variant="secondary"
              onClick={handleGoogle}
              disabled={!!loading}
              className="flex w-full items-center justify-center gap-2.5"
            >
              {loading === "google" ? (
                <UiIcon
                  size={16}
                  strokeWidth={1.5}
                  className="animate-spin"
                  icon={Loader2}
                />
              ) : (
                <UiIcon size={16} strokeWidth={1.5} icon={Globe2} />
              )}
              Continue with Google
            </Button>

            {/* Error */}
            {error && (
              <p
                role="alert"
                className="text-body mt-4 rounded-[var(--radius-md)] p-3 text-center"
                style={{
                  background: "var(--status-danger-dim)",
                  border: "0.5px solid var(--status-danger-border)",
                  color: "var(--status-danger)",
                }}
              >
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
