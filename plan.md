# Presense — Master Plan (v2)

Pure planning document. No status reports, no "here's what I found" narration — every line below is either a thing to build or a thing to verify before building. Each item is checked against your actual current zip; anything already done is removed, not just marked done.

---

## 0. Done since the last pass — removed from this plan, listed once for traceability

Confirmed built and working, not appearing further below:

- `viewportFit: 'cover'` + `width: 'device-width'` on the root viewport export.
- `RealtimeProvider` — single channel per table, ref-counted subscribe/unsubscribe, no teardown on visibility change, buffers updates while hidden and flushes on return. `useRealtime()` now delegates to it via context and wires `queryClient.invalidateQueries` per-table. Has its own test file.
- `Sheet.tsx` primitive — responsive (mobile bottom-sheet / desktop centered), drag-to-dismiss with velocity threshold, scroll lock, Escape handling. Adopted by `ConfirmModal`, `SearchModal`, `CaptureModal`.
- `ConfirmModal` async handling — awaits `onConfirm()`, shows loading state, disables backdrop during the action.
- Mobile shell: `MobileTopBar.tsx` (avatar→Settings, search, inbox) + `MobileDrawer.tsx` — Settings/Search are now reachable on mobile.
- Quick Capture moved into BottomNav as a center action item instead of a separate floating FAB — `FAB.tsx` deleted, avoids the FAB/bottom-nav overlap class of bug entirely rather than just repositioning it.
- `Dropdown`/`SelectDropdown` duplicate merge, double-`<Toaster>` fix, hardcoded LAN IP removal, `/verify-db` route removal, manifest icon split, `linked_people` cleanup trigger on person-delete, Settings Data-tab actions (export/delete account/clear completed/clear stale locations) all genuinely functional.
- Vitest + Playwright test infrastructure exists (`tests/sanity.spec.ts`, `tests/realtime.spec.ts`, `src/lib/__tests__/`).

---

## 1. Bugs — fix first, small, currently live

### 1.1 Undated tasks land in "Upcoming"
`src/app/(app)/do/page.tsx` line 280: `if (!t.deadline) return true;` inside the `upcoming` filter. A task with no deadline renders "No deadline" on its own card while filed under a column titled "Upcoming."

**Fix:** add a fourth bucket (`someday` / no-date) excluded from `overdue`/`today`/`upcoming`; render as a collapsed-by-default section below Upcoming.

### 1.2 Two columns for the same relationship
`TaskAddPanel.tsx` writes person-links to `items.linked_people_ids`. `CaptureModal.tsx` writes to `items.linked_people` (lines 265, 293). The person profile page only reads `linked_people_ids`, so anyone `@mentioned` via Quick Capture never appears on their own profile.

**Fix:** standardize on `linked_people_ids` (has the GIN index, has cleanup-trigger coverage). Update `CaptureModal.tsx`'s two write sites. Migrate any existing `linked_people` data into `linked_people_ids`, then drop the redundant column.

### 1.3 Double scroll-lock on Sheet-wrapped modals — new, introduced by the Sheet migration
`SearchModal.tsx` still sets `document.body.style.overflow = "hidden"/"unset"` itself (lines 30, 32) on top of `Sheet.tsx`'s own identical scroll-lock `useEffect`. Two independent effects writing to the same `document.body.style.overflow` risk leaving scroll in the wrong state depending on cleanup-order timing.

**Fix:** remove the scroll-lock code from `SearchModal.tsx` (and check `CaptureModal.tsx`/`ConfirmModal.tsx` for the same leftover) now that `Sheet` owns this responsibility.

### 1.4 Delete Account doesn't delete the auth record
`handleDeleteAccount` deletes all rows across all 8 user tables (real, not a stub) but never calls the Supabase Admin API to remove the `auth.users` row, since that needs a service-role key the browser client doesn't hold.

**Fix:** either relabel the button to describe what it actually does ("Delete my data"), or add one small Next.js API route using the service-role key server-side to call `supabase.auth.admin.deleteUser()` after the client-side wipe succeeds.

### 1.5 Migration filename reads backwards
`20260629081541_remove_linked_people_trigger.sql` creates the cleanup trigger; it doesn't remove one. Rename to `add_linked_people_cleanup_trigger.sql` in the same PR as 1.2.

---

## 2. Realtime / data-layer — small remainder, not a rebuild

The core architecture (section 0) is done. What's left:

- 11 call sites still call `useRealtime()` by its old name rather than `useRealtimeContext()` directly. Not urgent — the shim correctly delegates to the provider today — but migrating them removes a layer of indirection and lets the now-dead standalone-fallback path in `useRealtime.ts` (the `isVisible`-gated branch, only reachable if `RealtimeContext` is absent) be deleted entirely.
- Add a small `useRealtimeStatus()` export from `RealtimeProvider` returning `'connected' | 'reconnecting' | 'disconnected'`, surfaced as a top-bar pill. Currently nothing in the app shows connection state.

---

## 3. Confirmed-still-open mobile/shell fixes

| # | Issue | File | Fix |
|---|---|---|---|
| 3.1 | Bottom-nav blur too heavy for mid-range Android | `Navigation.tsx:331` — `backdrop-blur-2xl` | Drop to `backdrop-blur-md`, keep existing `/95` solid fallback |
| 3.2 | Sidebar `transition-[width]` causes layout thrash | `Navigation.tsx:66` | Replace with `transform: translateX()` on a fixed-width rail |
| 3.3 | `new Date()` read at render in Sidebar | `Navigation.tsx:124` | Wrap in `useMemo` keyed on `userSettings.last_ritual_date` + current hour-bucket |
| 3.4 | Single `md:` sidebar breakpoint cramps the Do board's `grid-cols-3` | `do/page.tsx` | Icon-rail at `md:` (64px), full sidebar at `lg:` (220px) |
| 3.5 | `100vh` causes iOS Safari URL-bar clipping | `CalendarView.tsx`, `global-error.tsx` — not Pomodoro/Ritual, those use `fixed inset-0` and don't have this problem | Convert the two real instances to `100dvh` |
| 3.6 | 16px input rule to prevent iOS auto-zoom | `.input` class / mobile inputs | `@media (max-width: 767px) { input, textarea, select { font-size: max(16px, var(--text-md)); } } ` |

---

## 4. Sheet migration — finish the rollout

The primitive and the first three migrations are done (section 0). Remaining:

- Migrate `TaskAddPanel`, `LocationAddPanel`, `AddPersonPanel`, `SettingsModal` (largest, do last) to `<Sheet>`.
- Add `useDialogFocus` to `Sheet.tsx` itself, once, rather than per-modal — confirmed it's currently used only by `SettingsModal` and `SearchModal` directly, and not by `Sheet` or by `ConfirmModal`/`CaptureModal` despite both having migrated to `Sheet`. Putting the focus trap inside the primitive fixes all current and future consumers at once.
- `Sheet.tsx` imports `motion`/`AnimatePresence` directly from `framer-motion`, not `m` from the lazy-loaded path other migrated files now use (`ConfirmModal.tsx` correctly imports `m`). Fix `Sheet.tsx`'s import before going further — see section 6, this is blocking the bundle-size work, not separate from it.

---

## 5. Glass / performance budget

`GlassCard.tsx` is unchanged: `p-6` fixed default, no blur-tier split, still fans out across all primary list views (Do, Inbox, Think, Explore, People, Locations).

**Fix:** split into a no-blur list variant and a `glass-card-elevated` blur-retained variant for modals/sidebar/hero. Pair with 3.1's bottom-nav blur reduction — these are the two highest-usage-count blur surfaces in the app.

---

## 6. Motion bundle-size — finish what's started, don't restart it

`MotionProvider.tsx` exists and wraps `(app)/layout.tsx` with `LazyMotion` — but using `domAnimation` (+15kb, no drag support per Motion's own docs), while `Sheet.tsx`, `TaskCard.tsx`, and the People/Explore/Inbox pages all use `drag="..."`, which requires `domMax` (+25kb). And zero files have migrated from `motion.*` to `m.*` except the handful already touched by the Sheet migration — meaning `LazyMotion`'s actual bundle-size benefit (34kb → ~4.6kb base) isn't being realized yet; any raw `motion.*` usage inside a `LazyMotion` boundary either throws (in `strict` mode) or silently loads the full bundle anyway (without `strict`), and this provider currently has neither `strict` set nor a completed sweep.

**Fix, in order:**
1. Switch `MotionProvider.tsx` from `domAnimation` to `domMax`.
2. Add `strict` to `LazyMotion` so any remaining raw `motion.*` usage fails loudly during development instead of silently negating the optimization.
3. Mechanically sweep all remaining `motion.div`/`motion.button`/etc. (5 raw usages confirmed outside the already-migrated Sheet-based files, plus `Sheet.tsx` itself) to `m.*`.
4. Add `<MotionConfig reducedMotion="user">` inside `MotionProvider.tsx`. This is the one item from the original plan still fully unstarted: `useReducedMotion.ts` exists as a real, correct hook but has zero call sites, and per Motion's own docs, the `MotionConfig` approach is strictly better here — one line at the provider level disables transform/layout animations app-wide for users with the OS preference set, instead of requiring per-component wiring of the unused hook across 29+ files. Do this instead of starting to wire `useReducedMotion()` manually into components.

---

## 7. New mobile hooks — built but unused, wire them in

`useHaptics.ts`, `useMediaQuery.ts`, `useIsTouch.ts`, `useVisualViewport.ts` all exist as real implementations. Only `useHaptics` has a call site (one). The other three are scaffolding ahead of adoption.

- `useIsTouch()` → gate every `whileHover`/`:hover` effect in `Navigation.tsx`, `TaskCard.tsx`, and the Campsite-style tile-hover work in section 9, so hover doesn't "stick" after a tap on touch devices.
- `useMediaQuery()` → drive the `md:`/`lg:` sidebar tier from 3.4, and any future JS-level (not just CSS-level) breakpoint branching.
- `useVisualViewport()` → wire into `Sheet.tsx` so open sheets reflow above the soft keyboard on mobile, instead of being covered by it.
- `useHaptics()` → expand its one call site to: task complete, task delete, modal open, Sheet swipe-dismiss commit.

---

## 8. Offline support — fully unstarted, real scope item

Confirmed: no service worker, no `idb`/IndexedDB usage, no `/offline` route anywhere in the codebase.

- Install `serwist` (Next.js-native, lighter than `next-pwa`). Precache the app shell, fonts, and icons.
- Runtime caching: `NetworkFirst` for Supabase API calls with cache fallback, `StaleWhileRevalidate` for static assets, `CacheFirst` for images/fonts.
- `src/app/offline/page.tsx` — shown when the network is unavailable and no cached shell can serve the request.
- `src/lib/db.ts` via `idb` — cache `items`/`people`/`user_settings` locally for instant load and a background-sync queue for mutations made while offline. Last-write-wins conflict resolution, with a toast notifying the user if a queued offline edit was overwritten by a newer server write on reconnect.
- Wire this to the `useRealtimeStatus()` indicator from section 2 — the offline page and the in-app reconnect pill should share one source of truth for connection state, not two independent detectors.

---

## 9. Beauty / micro-interaction pass

Unstarted. Ordered by leverage, not by source document — each item names its real, independently-verifiable product reference rather than an invented animation curve.

- **Linear-style reconnect indicator** — wire directly to `useRealtimeStatus()` (section 2): a small top-bar pill, rotating-ring while reconnecting, expanding-ring pulse on reconnect. This is the one purely-decorative item that's also closing a real functional gap (no connection-state UI exists today at all).
- **Mobbin-style nav icon hover** — `Navigation.tsx` hover currently changes background only; add a 2px icon `translateX` alongside the existing background change, gated behind `useIsTouch()` from section 7 so it doesn't fire on tap-then-stuck-hover on mobile.
- **Linear-style eased progress fill** — apply to `WorkloadBar.tsx` (ritual capacity) and the Pomodoro SVG ring; both should use a `pathLength` spring instead of a discrete/linear fill.
- **Campsite-style card hover** — mouse-position-driven tilt (`rotateX`/`rotateY` via `useMotionValue` + `useTransform`) on Home space-tiles and Explore tiles. Disabled via `useIsTouch()`; touch devices get a sharper press-state instead.
- **mymind-style "settle" on archive** — `ExploreDrawer`'s save/complete action gets a distinct brief scale+settle, separate from `TaskCard`'s existing (already-correct, already-shipped, do not touch) checkbox check-off animation.
- **Vercel-style idle nudge** — a one-time wiggle on the star/pin action in People/Explore/Threads after ~6s of dwell without interaction, once per session, only if not yet pinned.
- **Airbnb-style range slider** — replace the bare number input for Pomodoro duration and `daily_capacity_minutes` with a draggable slider.
- **Luma-style cursor-follow glow** — `--mouse-x`/`--mouse-y` custom properties via a `mousemove` listener, radial gradient following the cursor inside `.btn-primary` and the BottomNav's center Capture action. ~10 lines, desktop-only (gate behind `useIsTouch()`).
- **Skip:** Height's rainbow conic-gradient hover — confirmed mismatch with `design_identity.md`'s amber/navy/forest Warm Atmosphere identity; not included.

---

## 10. Execution order

1. Section 1 (bugs) — small, safe, independent of everything else.
2. Section 6 (finish the Motion/bundle-size work already in flight) — do this before section 4's remaining Sheet migrations or section 9's hover/tilt work, since both depend on the `m`/`domMax`/`MotionConfig` foundation being correct first, and starting new motion work on top of the current half-finished `domAnimation` setup means redoing it twice.
3. Section 4 (finish Sheet rollout) + Section 5 (glass budget) — natural pairing, same surfaces.
4. Section 3 (remaining shell fixes) — independent, can run in parallel with 2–3 on a second work-stream.
5. Section 7 (wire up the unused hooks) — depends on section 6 being done first for the `useIsTouch`-gated hover work in section 9 to make sense.
6. Section 2's remainder (status pill, shim cleanup) — small, do whenever convenient.
7. Section 8 (offline) — largest unstarted scope item, sequence last since it's the most independent of the others.
8. Section 9 (beauty pass) — last, purely additive.
