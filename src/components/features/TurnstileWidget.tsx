"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * SEC2-02/SEC2-03 (2026-08-16): self-contained Cloudflare Turnstile widget.
 *
 * Zero-dependency on purpose (Law 1 — only ticket files): loads the Turnstile
 * JS API from Cloudflare's CDN on demand instead of adding an npm package.
 *
 * Renders nothing until the script resolves; exposes the challenge token to
 * the parent via `onTokenChange` so it can be forwarded to the auth server
 * actions (GoTrue expects the token on signInWithOtp when captcha is enabled).
 */

declare global {
  interface Window {
    turnstile?: {
      render(
        container: string | HTMLElement,
        options: Record<string, unknown>,
      ): string;
      remove(widgetId: string): void;
      reset(widgetId: string): void;
      isExpired(widgetId: string): boolean;
    };
  }
}

const TURNSTILE_SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js";

export function TurnstileWidget({
  sitekey,
  onTokenChange,
}: {
  sitekey: string;
  onTokenChange: (token: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  });
  const [ready, setReady] = useState(false);

  const renderWidget = useCallback(() => {
    if (!window.turnstile || !containerRef.current || widgetIdRef.current)
      return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey,
      callback: (token: string) => onTokenChangeRef.current(token),
      "error-callback": () => {
        // Widget failed to solve itself — clear any stale token so a retry
        // request is not sent with an invalid/expired challenge.
        onTokenChangeRef.current("");
      },
      "expired-callback": () => onTokenChangeRef.current(""),
    });
    setReady(true);
  }, [sitekey]);

  // Load the Turnstile script once per page.
  useEffect(() => {
    const existing = document.head.querySelector<HTMLScriptElement>(
      `script[src="${TURNSTILE_SCRIPT}"]`,
    );
    if (existing) {
      // Script already present — render immediately if turnstile is up.
      renderWidget();
      return;
    }

    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => renderWidget();
    document.head.appendChild(script);

    return () => {
      // Clean up the widget (but not the shared script) on unmount.
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
    // renderWidget depends only on sitekey (stable) — re-render handles widget rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      role="status"
      aria-live="polite"
      aria-label={
        ready
          ? "Security check"
          : "Loading security check — the sign-in button stays disabled until it completes"
      }
      style={{
        display: "flex",
        justifyContent: "center",
        minHeight: ready ? 65 : 0,
        opacity: ready ? 1 : 0,
      }}
    />
  );
}
