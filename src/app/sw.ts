import type {
  PrecacheEntry,
  RuntimeCaching,
  SerwistGlobalConfig,
} from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const DAY = 24 * 60 * 60;

// Only static, public assets are cached. Pages, RSC payloads, /api and
// Supabase stay network-only, so nobody's tasks sit in Cache Storage after
// they sign out (Serwist's defaultCache would keep all of those).
const runtimeCaching: RuntimeCaching[] = [
  {
    // Hashed build output never changes under the same URL.
    matcher: ({ sameOrigin, url }) =>
      sameOrigin && url.pathname.startsWith("/_next/static/"),
    handler: new CacheFirst({
      cacheName: "next-static",
      plugins: [
        new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * DAY }),
      ],
    }),
  },
  {
    matcher: ({ sameOrigin, url }) =>
      sameOrigin && /\.(?:png|svg|ico|webp|woff2?)$/i.test(url.pathname),
    handler: new StaleWhileRevalidate({
      cacheName: "static-assets",
      plugins: [
        new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 30 * DAY }),
      ],
    }),
  },
  { matcher: /.*/i, handler: new NetworkOnly() },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: false,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// A reminder from supabase/functions/push_reminders. The payload is Safari's
// declarative format ({ web_push: 8030, notification: {...} }); other
// browsers deliver it here and this shows it. Every push must show a
// notification: browsers revoke push for sites that stay silent.
self.addEventListener("push", (event) => {
  let n: {
    title?: string;
    body?: string;
    tag?: string;
    navigate?: string;
  } = {};
  try {
    n = event.data?.json()?.notification ?? {};
  } catch {
    // Unreadable payload: still show something rather than nothing.
  }
  event.waitUntil(
    self.registration.showNotification(n.title || "Presense", {
      body: n.body,
      tag: n.tag,
      icon: "/icon-192.png",
      badge: "/icon-96.png",
      data: { url: n.navigate || "/" },
    }),
  );
});

// Tapping a reminder opens what it's about (a task on Do, or the ritual on
// Home) in an open Presense window if there is one, otherwise a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path =
    typeof event.notification.data?.url === "string"
      ? event.notification.data.url
      : "/";
  // Only ever open our own pages.
  const target = new URL(path, self.location.origin);
  const url =
    target.origin === self.location.origin ? target.href : self.location.origin;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const open = windows.find(
        (w) => new URL(w.url).origin === self.location.origin,
      );
      if (open) {
        const focused = await open.focus();
        // Same app, so take it to the reminder's page. navigate() only works
        // on a window this worker controls; otherwise the page does it.
        if (focused.url !== url) {
          await focused
            .navigate(url)
            .catch(() =>
              focused.postMessage({ type: "presense:navigate", url }),
            );
        }
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
