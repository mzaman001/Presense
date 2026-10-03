"use client";

import { useEffect } from "react";

/**
 * Registers the service worker served by src/app/serwist/[path]/route.ts.
 * Plain `register()` instead of Serwist's provider: the provider ships
 * @serwist/window in every page's initial JS (it pushed /login over its
 * budget), and Presense uses none of its features. Off outside production
 * so dev never serves a stale worker. Waits for the load event so the
 * worker's install never competes with the first paint.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // A tapped reminder, when the worker couldn't navigate this window
    // itself (see notificationclick in sw.ts). Same-origin only.
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null;
      if (data?.type !== "presense:navigate" || typeof data.url !== "string") {
        return;
      }
      const target = new URL(data.url, window.location.origin);
      if (target.origin === window.location.origin) {
        window.location.assign(target.href);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    const register = () => {
      navigator.serviceWorker
        .register("/serwist/sw.js", { scope: "/" })
        .catch(() => {
          // No worker means no offline page or reminder taps; the app works.
        });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => {
      window.removeEventListener("load", register);
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
