"use client";

import { useState } from "react";
import { Globe2, Mail, Loader2, Sparkles, ArrowRight } from "lucide-react";
import {
  OnboardingBackground,
  PresenseLogo,
} from "@/components/layout/OnboardingBackground";
import { sendMagicLink, startGoogleSignIn } from "./actions";
import { Button } from "@/components/ui/button";
import { Icon as UiIcon } from "@/components/ui/Icon";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formDataWith = (pairs: Array<[string, string]>) => {
    const fd = new FormData();
    pairs.forEach(([k, v]) => fd.append(k, v));
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
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden p-4">
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
        {/* Logo */}
        <div className="mb-8 flex items-center gap-2.5">
          <PresenseLogo size={28} />
          <span
            className="text-title-lg font-semibold tracking-tight"
            style={{ color: "var(--text-1)" }}
          >
            Presense
          </span>
        </div>

        {emailSent ? (
          /* Email sent state */
          <div className="py-4 text-center">
            <div
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background: "rgba(45,212,191,0.10)",
                border: "0.5px solid rgba(45,212,191,0.25)",
              }}
            >
              <UiIcon
                size={22}
                strokeWidth={1.5}
                className="text-[#2DD4BF]"
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
              <h1
                className="mb-1 text-[22px] font-semibold tracking-tight"
                style={{ color: "var(--text-1)" }}
              >
                Sign in
              </h1>
              <p className="text-body" style={{ color: "var(--text-3)" }}>
                Welcome back, second brain.
              </p>
            </div>

            {/* Email form */}
            <form onSubmit={handleMagicLink} className="mb-4 space-y-3">
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
                className="input w-full"
              />
              <div className="flex justify-end">
                <span
                  className="text-ui"
                  style={{ color: "var(--accent-text)" }}
                >
                  Magic link &#x2014; no password needed
                </span>
              </div>
              <Button
                variant="primary"
                type="submit"
                disabled={!!loading || !email.trim()}
                className="flex w-full items-center justify-center gap-2"
              >
                {loading === "email" ? (
                  <UiIcon
                    size={14}
                    strokeWidth={1.5}
                    className="animate-spin"
                    icon={Loader2}
                  />
                ) : (
                  <UiIcon size={14} strokeWidth={1.5} icon={Sparkles} />
                )}
                Send sign-in link
                <UiIcon
                  size={14}
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
                  size={14}
                  strokeWidth={1.5}
                  className="animate-spin"
                  icon={Loader2}
                />
              ) : (
                <UiIcon size={14} strokeWidth={1.5} icon={Globe2} />
              )}
              Continue with Google
            </Button>

            {/* Error */}
            {error && (
              <p
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
