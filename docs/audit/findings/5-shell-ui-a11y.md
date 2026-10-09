# Audit findings: 5-shell-ui-a11y

2026-10-08, `main` at `6d8ac96`. Method: a production build in Playwright's full Chromium, signed in as the seeded account where needed, plus reading the code behind each finding.

Browser checks:
- **Axe** (WCAG 2.0/2.1/2.2 A and AA) on `/login`, `/privacy`, `/terms` and `/~offline`, in light and dark (slice 4 already scanned the signed-in pages).
- **Reflow** at 320 px (WCAG 1.4.10) on Home, Do, Inbox, Think, Remember and Trash.
- **Keyboard:** the skip link, the Settings dialog's focus trap and focus restore, and the phone drawer with Escape.
- **Reduced motion:** running animations counted after opening a dialog.
- **Installed app:** the manifest, every icon and the service-worker script.
- **Theme:** whether the server HTML carries it.

| Severity | Count |
|---|---|
| P0 | 0 |
| P1 | 1 |
| P2 | 2 |
| P3 | 2 |

**What's solid** (checked, nothing to do):
- **Axe:** no violations on any public page, in light or dark.
- **Reflow:** no page scrolls sideways at 320 px. Do's filter chips run past the edge only inside their scrollable row.
- **Phone drawer:** opens as a dialog, Escape closes it, and focus returns to the menu button.
- **Reduced motion:** with `prefers-reduced-motion`, opening capture starts no animation.
- **Installed app:**
  - the manifest has name, `id`, `start_url` and `display: standalone`;
  - a capture shortcut and a share target;
  - six icons, all 200, including maskable ones;
  - `/serwist/sw.js` is served as JavaScript.
- **Service worker:** matches the documented design (static assets cached, pages, `/api` and Supabase network-only, an offline fallback). The notification tap opens same-origin URLs only.
- **Route-level errors:** `error.tsx` reports to Sentry through `AppErrorFallback`.
- **No theme flash on a used device:** an inline script sets the theme from `localStorage` before first paint.

---

### [P1] Keyboard focus escapes open dialogs, and doesn't return when they close
- **Where:** `src/hooks/useDialogFocus.ts`, used by `Sheet` (capture, search, task, location, reminder and stuck-task panels), `SettingsModal`, and others.
- **Evidence:** with Settings opened from the rail by keyboard, Tab left the dialog, and after Escape focus was on Do's "Archive" button, not the Settings button.
  - **Trap:** it wraps only when focus is exactly on the last element its selector matches. That list includes hidden elements (Settings' phone-only section strip, panels not shown), so the last visible stop isn't "last", and Tab walks out.
  - **Restore:** it runs only when `isOpen` turns false. Settings calls `useDialogFocus(true)` and simply unmounts on close, and `Sheet` closes by unmounting too since #79, so the restore never runs.
- **Impact:** keyboard and screen-reader users end up behind an open modal, and after closing one they lose their place. This fails WCAG 2.4.3 (Focus Order) and the modal pattern of 2.1.2.
- **Fix:**
  - **Trap:** consider only elements that are rendered, i.e. not `display:none`, not inside `[hidden]`, with `getClientRects().length > 0`. When focus is outside the container on Tab, move it to the first element.
  - **Restore:** restore focus in the effect's cleanup, which covers both close and unmount. Skip it if the saved element is no longer connected.
- **Verify:** an RTL test (Tab from the last visible element wraps to the first, and unmounting returns focus to the trigger) plus the same Playwright steps.
- **Confidence:** confirmed (browser and code).

### [P2] "Skip to content" doesn't move focus
- **Where:** `src/app/(app)/layout.tsx:101` (`href="#main-content"`) → `AppContentWrapper.tsx:85` (`id="main-content"`, not focusable).
- **Evidence:** Tab to "Skip to content", Enter, and `document.activeElement` is `body`.
- **Impact:** screen readers aren't moved to the content and announce nothing. Whether the next Tab starts inside main varies by browser. WCAG 2.4.1 (Bypass Blocks) expects the skip to land.
- **Fix:** `tabIndex={-1}` on `#main-content` (with `outline-none` for that element only), so the link moves focus there.
- **Confidence:** confirmed.

### [P2] A crash inside a modal never reaches Sentry
- **Where:** `src/components/ui/ModalErrorBoundary.tsx:25-27`: `componentDidCatch` only calls `logger.error`, which is the browser console on the client.
- **Impact:** Capture, Search and Settings each sit inside this boundary. A render error there shows the fallback to the user, but nothing reports it. Route-level errors do report (`AppErrorFallback`).
- **Fix:** call `captureException(error, { tags: { modal: modalName }, extra: errorInfo })` from `@/lib/sentry-client`, the lazy client already used elsewhere.
- **Confidence:** confirmed.

### [P3] Smaller items
- **First visit on a new device (or after sign-out) briefly shows dark mode** before a light-mode user's setting applies. The pre-paint script reads `localStorage`, which sign-out clears (`clearLocalAccountData`, as before #92). Fix: when signing in, write the user's theme keys before the first app page, or have the server render the theme class from `user_settings`.
- **Hidden elements in focus queries elsewhere:** the selector pattern above also appears in other focus helpers. Reuse one `focusableWithin(container)` helper that filters out hidden elements, for any future dialog code.

---

## Coverage

Checked in the browser as above. Read for the risky paths:
- `useDialogFocus`, the skip link and its target;
- `ModalErrorBoundary`, `AppErrorFallback` and the route `error.tsx` files;
- `sw.ts` (caching, fallback, push, notification click);
- `public/manifest.json` (via the served file), and the root `layout.tsx`'s theme script.

Not read line by line: most of `src/components/ui/*` (42 primitives) and `src/components/layout/*` (25), `globals.css` (about 3k lines), and the onboarding wizard and login page code. Their rendered output was covered by Axe and the reflow and keyboard checks above, and in slices 3–4.
