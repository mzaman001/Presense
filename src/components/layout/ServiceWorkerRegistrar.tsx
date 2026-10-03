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

    const register = () => {
      navigator.serviceWorker
        .register("/serwist/sw.js", { scope: "/" })
        .catch(() => {
          // No worker means no offline page or reminder taps; the app works.
        });
    };
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
