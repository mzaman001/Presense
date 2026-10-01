"use client";

import { useState, useSyncExternalStore } from "react";
import { Globe2, Loader2 } from "lucide-react";
import { BrandMark } from "@/components/ui/BrandMark";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { startGoogleSignIn } from "./actions";
// Not ui/button: that merges classes through cn(), which would bring
// tailwind-merge (~8 KiB gz) into the one public page. These buttons add
// only non-conflicting classes, so plain variant classes are enough.
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Icon as UiIcon } from "@/components/ui/Icon";

const noSubscribe = () => () => {};
const readCallbackFailed = () =>
  new URLSearchParams(window.location.search).has("error");

// Google is the only sign-in method. Email links were removed on 2026-10-02:
// Supabase's built-in mailer only delivers to the project's own team, so they
// never reached real users. Bringing them back needs custom SMTP first.
export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // /auth/callback sends failed sign-ins back here with ?error=auth_failed.
  // useSyncExternalStore reads the URL in the browser only (false on the
  // server), so hydration matches; useSearchParams would need a Suspense
  // boundary around this whole page.
  const callbackFailed = useSyncExternalStore(
    noSubscribe,
    readCallbackFailed,
    () => false,
  );
  const shownError =
    error ??
    (callbackFailed && !loading
      ? "Sign-in didn't complete. Please try again."
      : null);

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("origin", window.location.origin);
      const result = await startGoogleSignIn(fd);
      if (result.error) {
        setError(result.error);
        setLoading(false);
      } else if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start Google sign-in",
      );
      setLoading(false);
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

        {/* Heading */}
        <div className="mb-7">
          <h1 className="font-heading mb-1 text-[length:var(--text-title-2xl)] font-medium tracking-[-0.01em] text-[var(--text-1)]">
            Sign in
          </h1>
          <p className="text-body" style={{ color: "var(--text-3)" }}>
            Pick up where you left off.
          </p>
        </div>

        <ButtonPrimitive
          data-slot="button"
          onClick={handleGoogle}
          disabled={loading}
          className={buttonVariants({
            variant: "primary",
            className: "w-full",
          })}
        >
          {loading ? (
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
        </ButtonPrimitive>

        {/* India's DPDP Act treats under-18s as children (parental consent
            required), so Presense is 18+. Sign-in and sign-up are the same
            flow here, so this line covers new accounts too. */}
        <p className="text-meta mt-5 text-center text-[var(--text-3)]">
          By continuing, you confirm you&apos;re 18 or older and agree to the{" "}
          <a
            href="/terms"
            className="text-[var(--accent-text)] underline underline-offset-2"
          >
            Terms
          </a>{" "}
          and{" "}
          <a
            href="/privacy"
            className="text-[var(--accent-text)] underline underline-offset-2"
          >
            Privacy Policy
          </a>
          .
        </p>

        {shownError && (
          <p
            role="alert"
            className="text-body mt-4 rounded-[var(--radius-md)] p-3 text-center"
            style={{
              background: "var(--status-danger-dim)",
              border: "0.5px solid var(--status-danger-border)",
              color: "var(--status-danger)",
            }}
          >
            {shownError}
          </p>
        )}
      </div>
    </div>
  );
}
