# Presense Design System Overhaul — Design Spec

Status: draft, awaiting review
Track: 1 of 2 (design/UX + feature scope). Performance & memory is a separate follow-up spec, out of scope here — though several decisions below (§3, §9) reduce load work as a side effect.

## 1. Problem & goals

Presense is functional but doesn't look or feel considered: the sidebar is visually inconsistent, behaviorally unreliable, and broken on mobile; dropdowns have positioning glitches and dated visual treatment; the app's spaces don't share a coherent visual or interaction language; onboarding and sign-in don't set a tone; two features (Explore, People) exist but don't earn their maintenance cost; and the whole thing reads as generic rather than considered.

Goal: a single, coherent design system — tokens, components, patterns — applied consistently across a *smaller, sharper* set of spaces, that feels calm, personal, and quietly premium ("Apple-level" craft, not decorated), works as a mobile-first PWA, and meets WCAG AA.

Non-goals: performance/memory optimization as its own workstream (separate track), and re-litigating backend/data architecture (Supabase/RLS/TanStack Query patterns in `AGENTS.md` §1 stay as-is).

## 2. Product framing

Presense is a **personal task and memory manager** — single-user, no collaboration features. Five areas after the cuts in §3 (down from six):

| Area | Purpose |
|---|---|
| **Home** | The daily ritual loop (morning plan → focus → evening review) plus a weekly review. Not a dense dashboard, not a bare launcher. |
| **Inbox** | Unsorted quick-capture. Fast add, triage later into a space. |
| **Do** | Tasks — board / today / calendar views, categories, archive. |
| **Remember** | Reminders, plus the Locations item-tracker ("where did I put my keys"). No relationship/contact database. |
| **Think** | Journaling / threads, with stale-thread resurfacing and Daily/Weekly notes. |

Plus **Settings** (modal) and **Trash**.

Do, Remember, and Think share one page template (header + content shell + shared interaction patterns) with room for per-space identity within it. Home and Inbox stay structurally distinct because their jobs differ from the other three.

## 3. Feature decisions: cut, keep, and promote

Grounded in reading the actual implementation, not the feature list. These are decisions, not open questions — see §19 for the one thing still deferred (existing-data handling).

### Cut

- **Explore as a space** (`explore/page.tsx`). It's a smaller, weaker Raindrop/Pocket/Goodreads clone: links, notes, quotes, books, tags, archive — bolted onto a task app with no feedback loop back into Do or Think. Dedicated tools already do this better, and it asks for ongoing curation with no payoff.
- **People as a space** (`remember/people/page.tsx`). A genuinely well-built mini-CRM (drag-reorder, swipe-to-delete, a dedicated `/api/people/reorder` route, "Today's Briefings") — but it asks a solo user to hand-maintain a contacts database for a payoff ("briefings") they'd get from just remembering the meeting. This is the classic demo-good/week-two-abandoned shape.

### Keep, and in one case re-scope

- **Do** — unchanged in scope. Already well-engineered (board/today/calendar views, code-split calendar chunk, hover-preload on view switch, single-pass bucketing for perf).
- **Remember → Locations** (`remember/locations/page.tsx`). The best-scoped feature in the app: one line per lost item, a "stale — still here?" nudge after 30 days, near-zero maintenance cost, a real recurring pain point. Gets *more* visual attention in this redesign, not less — it stops being a buried `/remember/locations` sub-route and becomes what "Remember" visibly means.
- **Think** — unchanged in scope. Journaling with `stale_prompt` resurfacing and one-tap Daily Notes is a legitimate differentiator; most notes apps resurface nothing.
- **Inbox** — unchanged in scope, but its routing menu shrinks from 5 destinations (Do / Think / Explore / Remember-as-person / Locations) to 3 (Do / Remember / Think), since Explore and People-as-a-destination go away. Fewer choices at exactly the moment (unsorted capture) friction should be lowest.

### Promote

- **The ritual + weekly review system becomes Home**, not a feature hidden inside it. `getRitualDecision()` (`src/lib/rituals.ts`) and the "Week in Review" panel in `(app)/page.tsx` (completions vs. last week, focus minutes vs. last week, a day-of-week chart, an optional reflection saved into a pinned Think thread) are already fully wired to real data — they're just presented as a one-line sidebar nudge and a toggle button nobody notices. This is Presense's actual differentiator (a calm daily+weekly rhythm connecting Do and Think) and the redesign should make it the first thing Home shows, not a mode you switch into.
- **A visible ritual streak** (consecutive days both morning and evening rituals were completed). `last_ritual_date` / `last_evening_ritual_date` already exist — this is a display change, not new data plumbing. A streak tied to something the user already does is a legitimate mechanic, not gamification for its own sake.
- **"Stale, gently resurfaced" as one named, shared pattern**, not two bespoke implementations. Locations' 30-day staleness check and Think's `stale_prompt` are independently hand-rolled versions of the same idea. Unify into one mechanic in the design system (one component/hook, two call sites) — this is the kind of cross-cutting coherence "every corner has a purpose" is asking for.

### Cleanup this surfaces (folded into §16)

- Home (`(app)/page.tsx`) duplicates Inbox's entire "Route it" dropdown inline — same five destinations, same handler logic, a raw `createPortal` instead of the app's own `Dropdown`/`Popover`. Two divergent implementations of one feature. Fix: Home shows an Inbox **count + link**, not a second interactive inbox.
- Home's dashboard query fires 9 parallel Supabase queries per load (tasks, inbox, people, threads, explores, done, sessions, done-last-week, sessions-last-week). Cutting Explore and People removes 2 of those outright, and removing the duplicated routing UI removes the state/logic that goes with it — a direct, free contribution to the "app is slow to load" complaint, ahead of the separate performance track.
- The Home bento row's "People Tracked" and "Saved Items" tiles go away with their spaces. Replace with the ritual streak and a Locations-derived tile (e.g. "items logged" or "check on N stale items").

## 4. Design philosophy

**Calm, personal, sunrise/sunset-toned, executed at an Apple level of craft** — precise like Linear, warm like a meditation app, but built to feel "sexy" through restraint and finish, not decoration:

- **Light mode = sunrise. Dark mode = sunset.** Not a metaphor — a literal palette mapping: light mode's warm-neutral base and accent lean toward morning light (softer, brighter warmth); dark mode's near-black base and accent lean toward dusk/ember tones (deeper, warmer). See §7.
- **Flat, precise surfaces — no gradients, glow, glassmorphism, or neumorphism.** Depth comes from hairline borders and opacity-stacked surfaces, the way Linear's actual production UI works — not from decoration. This is what keeps it from reading as generic/AI-generated.
- **One theme, light + dark, not three.** The existing `warm`/`navy`/`forest` selector is retired.
- **One accent color: terracotta / burnt orange** (warmed toward sunrise in light mode, deepened toward ember in dark mode). Used sparingly — active nav state, unfinished-task ring, primary action border/underline. Never decorative.
- **Airy, spacious density**, mobile-first.
- **One small ambient living detail per screen at rest** — not fully static, not busy. A single soft, slow, GPU-cheap touch (see §8) rather than zero motion or many.
- **Typography carries the "personal, premium, calm" feeling**, not iconography or illustration (§6).
- **Haptics, not sound.** Subtle vibration on mobile for key moments (task complete, ritual finished — `useHaptics` already exists); no audio anywhere. Sound is easy to get wrong and many people use the app in silent contexts.

## 5. Component foundation

Adopt **shadcn/ui conventions** (Radix-based, copy-in components) as the styling/composition pattern going forward, replacing `@base-ui/react` incrementally as components are rebuilt space-by-space. `Dropdown.tsx` and `Popover.tsx` already render through `FloatingPortal` with `floating-ui` (`flip`/`shift`/`offset`) — the positioning engine is sound; what needs to change is visual treatment, and per AGENTS.md invariant 3 the portal-rendering discipline must be preserved in whatever replaces them. The reported positioning glitches get a targeted repro pass before assuming a rewrite fixes them.

Icons stay **Lucide** — refine stroke-width/sizing consistency, not the icon set.

## 6. Typography

Two-typeface system:

- **UI / body: Inter.** De facto standard for this kind of interface, extremely legible at small sizes, pairs cleanly with Lucide's stroke weight.
- **Headline / display: Newsreader** (Google Font). Decided in the Phase 2 brainstorming pass: a serif built for long-form reading, moderate stroke contrast (calmer than a dramatic display serif like Playfair), optical sizing so it stays crisp from large greeting-text sizes down to smaller section headers. Meets the brief from §4 — not Fraunces' soft/organic character, not classic-editorial, not plain — premium, calm, meditative, highly readable. Loaded via `next/font/google`.

## 7. Color system

Flat, opacity-stacked, single-accent, with an explicit sunrise/sunset split between modes:

- **Light mode ("sunrise"):** warm off-white/greige background (not pure white), near-black warm-toned text, hairline warm-grey borders, accent leaning toward a brighter morning amber.
- **Dark mode ("sunset"):** near-black warm-toned background (not pure black), warm off-white text, borders as low-opacity white overlays (`rgba(255,255,255,0.05–0.1)`), surfaces as low-opacity white fills — Linear's "luminance stacking" approach, not drop shadows — accent deepened toward ember/burnt orange.
- Both modes are **fixed palettes**, not tied to the device clock or geolocation — "sunrise/sunset" is the aesthetic identity of each mode, not a live simulation. (Considered and explicitly declined: real time-of-day theming adds timezone/geolocation complexity and risk of overriding a manual light/dark choice, for a subtlety that isn't worth the engineering cost right now.)
- All values become CSS custom properties in `src/app/globals.css` — no one-off hex values elsewhere.

## 8. Motion & transitions

- **Shared-element continuity as the default transition language.** Tapping a task morphs it into its detail view; the active tab indicator slides between Do's Board/Today/Calendar tabs; a completed task's checkmark and the list's reflow read as one continuous motion, not a cut. Built on Framer Motion's `layout`/`layoutId` (already used for exactly this in a few places — e.g. `bottom-nav-active` in `Navigation.tsx`) rather than plain crossfades. This is the concrete meaning of "fluid."
- **State-change motion stays short and cheap:** 150–250ms, transform/opacity only, on task-complete, modal open/close, and the shared-element transitions above.
- **One ambient detail per screen**, not idle motion throughout — e.g. a single soft, slow-breathing accent (the ritual streak indicator, or a quiet pulse on the "focus now" card) rather than multiple moving parts competing for attention.
- Everything respects `prefers-reduced-motion` — shared-element transitions degrade to instant/crossfade, ambient details stop entirely. `MotionProvider`'s `LazyMotion domMax strict` setup stays.
- **Haptics** (`useHaptics`, already present) mark key moments on mobile — task complete, ritual step finished. No sound anywhere in the app.

## 9. Navigation

- **Desktop:** keep the existing hover/focus-expand collapsible rail (`Sidebar()` in `Navigation.tsx`) as the interaction model — it's structurally sound (portal-free, CSS-width-transition, token-driven) — but redesign its visual treatment and fix the reported IA/interaction issues (ritual row complexity, the "Remember" link resolving to `/remember/people` specifically — which no longer exists post-cut — badge treatment).
- **Mobile:** a real bottom tab bar (`BottomNav()` already close to right) — thumb-reachable, native-feeling — not a drawer. Redesign visual treatment, audit/fix the reported mobile breakage, and reflect the new 5-space set.
- **Global quick-add:** a command palette (desktop, `Cmd+K`) and a floating action button (mobile). Destinations at capture time: **Do, Remember, Think** (Inbox as the no-decision default) — Locations is reached as a type within Remember, not a fourth top-level destination, matching how it already lives at `/remember/locations`.
- The duplicated inline routing dropdown in Home (§3) is deleted, not redesigned — Home links to Inbox instead of reimplementing it.

## 10. Modals & dialogs

**Centered dialogs** as the default pattern for edit/confirmation/settings/add flows, on both mobile and desktop. Existing `ConfirmModal.tsx`, `Sheet.tsx`, `DynamicModals.tsx` consolidate onto one dialog primitive (shadcn/Radix Dialog). `DynamicModals.tsx`'s conditional-render discipline (AGENTS.md §1) is preserved.

## 11. Empty states

Warm and encouraging, with a small tasteful illustration — fits the calm/personal tone and makes an empty Do/Think list feel intentional rather than broken. `EmptyState.tsx` gets extended to support this.

## 12. Accessibility

WCAG AA, verified with automated (`@axe-core/playwright`) plus manual keyboard/screen-reader spot checks on key flows. Every interactive element keeps a real focus state distinct from the terracotta accent-as-decoration use. Touch targets stay ≥44px primary, ≥36px otherwise (AGENTS.md §3).

## 13. Responsive strategy

**Mobile-first**, since that's the primary usage context. Bottom-tab nav, airy spacing, and large touch targets are designed for mobile first, then adapted up to desktop.

## 14. Brand mark

**A horizon arc** — a simple partial-circle/arc shape (~200°, suggesting a rising or setting sun against a horizon line), rendered in the single accent color only, no gradient. Replaces the current inline SVG circle-with-gradient in `Navigation.tsx`. Used on: login screen, PWA icon/favicon, sidebar brand tile. One mark works unmodified in both modes — it only ever uses `var(--accent)`, which already carries the light/dark distinction.

## 15. Onboarding & sign-in

- **Sign-in:** minimal and fast — also a performance fix (`/login` currently ships ~1.1MB JS for one email field).
- **Onboarding:** a deliberate first impression — a short, calm, well-crafted sequence, replacing `OnboardingWizard.tsx`. Should introduce the ritual loop (§3) as the app's core idea, since that's what's actually differentiated.

## 16. Cleanup process

Before deleting anything: **investigate and propose a list** with reasoning, for approval, per AGENTS.md §2.5. Known candidates surfaced so far (not final — proposed for approval when implementation reaches them):

- Home's inline duplicate of Inbox's routing dropdown (§3).
- Any component/route exclusively serving Explore or People once those spaces are removed (`ExploreDrawer.tsx`, `AddPersonPanel.tsx`, `/api/people/reorder`, `remember/people/*` routes) — proposed for removal, not touched silently.
- Overlap between `Dropdown.tsx`, `Popover.tsx`, `Sheet.tsx`, `ConfirmModal.tsx` once the shadcn Dialog/Dropdown primitives land.

## 17. Feature scope

This pass is not restricted to visual-only changes — §3 already exercises that latitude. Any further cut gets called out explicitly when it comes up, not silently dropped.

## 18. Rollout sequencing

1. **Foundation:** tokens (color/type/spacing/motion) in `globals.css`, core components (button, input, dialog, dropdown, nav shell, empty state) on the shadcn/Radix pattern.
2. **Home, sign-in, onboarding** — first full pages; Home specifically validates the promoted ritual/review system and the new bento tiles.
3. **Do, Remember, Think** — one at a time, each independently shippable, using the shared space template.
4. **Settings, Trash, Inbox polish** last.
5. **Explore and People removal** happens as its own step (see §19 for the open question on existing data) — not bundled silently into another space's redesign.

No hard deadline — sequencing optimizes for reviewability, not speed.

## 19. Testing

- `@axe-core/playwright` accessibility checks extended to cover every redesigned page/modal.
- Manual keyboard-only and screen-reader pass on: sign-in, onboarding, quick-add (all destinations), completing/deleting a task, every dialog type, mobile bottom-nav, desktop sidebar collapse/expand.
- Existing gates unchanged and must stay green throughout: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`.

## 20. Explicitly deferred to implementation

- **Specific IA changes** beyond the five-area set (§9) — proposed when the actual page is being rebuilt.
- **Specific list of components/files to delete** (§16) — proposed for approval before any deletion.
- **What happens to existing People and Explore data** when those spaces are cut. Default recommendation, to confirm before implementation reaches §18 step 5: keep the `people` and `explores` tables untouched (never drop per AGENTS.md §2.5) and unreachable from the main nav, but offer a one-time export (e.g. a CSV/JSON download from Settings) so nothing already saved there is silently lost. Open for a different call if preferred (e.g. a one-time migration of Explore items into Think, or People notes into a plain reminder).
- Settings page content/layout, search-within-a-space behavior, offline/PWA caching UX — handled as normal design decisions during implementation, escalated back only if genuinely ambiguous.

## 21. Phase 2 locked design: Navigation, Home, Sign-in, Onboarding

Decided in the Phase 2 brainstorming pass, after Foundation (Phase 1) shipped. This section is Phase 2's design; §18's rollout order is unchanged (Phase 2 = "Home, sign-in, onboarding" — nav redesign is folded into this phase rather than deferred further, since Home can't be meaningfully reviewed next to a still-glassy nav).

### Navigation (folded into this phase)

- **Desktop sidebar:** keep the hover/focus-expand rail as the interaction model (unchanged from §9) — re-skin only. Flat `--surface-sidebar` background, hairline right border (`--border-subtle`), no blur. The brand tile becomes the new horizon-arc mark (§14). Active-row indicator: a left accent bar + accent-colored text/icon — no background pill, since `--space-*` tokens are now all aliased to the one accent (Foundation §3 decision), a colored pill background would be redundant with the icon/text already being accent-colored. Icons unified to Lucide 20px/1.5 stroke everywhere, including the utility rows (Search/Focus/Trash/Settings), which currently use an inconsistent 17px — this was flagged in the project's own prior sidebar research and never fixed.
- **Ritual row:** stays a single row (not redesigned into something larger), but gets the sidebar's clearest visual treatment after the active nav item — it's the one row tied to the app's actual differentiator (§3).
- **Mobile bottom nav:** same flat re-skin, same current 5-slot layout (Home/Do/Capture/Think/Explore). Explore's nav slot is left in place for this phase and only removed when Explore is actually cut (§18 step 5) — avoids reshuffling the bottom nav twice.
- **Dropdown/Popover:** visual re-skin only (flat panel, hairline border, no blur) — the floating-ui positioning engine is unchanged, per §5's decision to investigate reported glitches rather than assume a rewrite is needed. That repro/fix happens within this phase since the nav's own dropdowns (account menu, etc.) are in scope here.

### Home

Restructured top-to-bottom around the promoted ritual/review system (§3), replacing the current toggle-into-a-different-view pattern:

1. Greeting (Newsreader, time-of-day aware) + the ritual state inline beneath it (today's morning/evening status, or the prompt to start one) — this replaces the separate `RitualStatusBadge` treatment with something that reads as part of the page, not a pill bolted onto the header.
2. "Focus Now" hero — the single highest-priority task, unchanged logic, re-skinned flat (no conic-gradient spinner decoration — a small static accent-colored ring or none at all).
3. Bento row, 4 tiles: Active Tasks (unchanged), Ritual Streak (new — §3's promoted streak), Locations tile (new — replaces "People Tracked"; shows count of logged items or count needing a "still here?" check), Focus Time or Tasks Completed This Week (replaces "Saved Items"; whichever reads more naturally next to a streak tile, implementer's call).
4. "Up Next" list and Inbox section stay, but Inbox's entire inline "Route it" dropdown is deleted — Home shows an item count + a link to `/inbox`, nothing interactive inline (§3's cleanup finding).
5. Week in Review becomes reachable from Home (not hidden behind discovery) but doesn't need to be the default view — a clearly-visible link/tab is enough; it doesn't need to be inlined into the main scroll.

### Sign-in

Single email field, magic-link primary action, Google secondary — same auth logic, entirely new shell: the horizon-arc mark, "Sign in" in Newsreader, flat card (`--surface-modal`, hairline border, no blur), no gradient button. This is also where the ~1.1MB JS bundle gets fixed structurally (whatever's pulling in that weight — audited during implementation, not pre-diagnosed here) since the page is being rebuilt anyway.

### Onboarding

Cut from `OnboardingWizard.tsx`'s current 5 steps down to 2–3: enough to say who the app is for and introduce the ritual loop as the core idea (§3, §15), not a full feature tour. Uses the new mark/typeface. Background stays the static (non-animated) treatment already shipped in the Foundation-phase fix (`OnboardingBackground.tsx`'s dead keyframes were removed, not restored) — animating it properly, if wanted, is explicitly out of scope for this phase and can be revisited later without blocking on it.

### Deferred within Phase 2 (proposed during implementation)

- Exact bento-tile copy/icons for the two new Home tiles.
- Exact onboarding screen count (2 vs 3) and copy — implementer proposes, doesn't need to come back for approval unless genuinely ambiguous.
- The `/login` bundle-size root cause — diagnosed when the page is actually rebuilt.
