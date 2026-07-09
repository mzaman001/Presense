# DESIGN_SYSTEM.md — Presense

> Read this before touching any UI. This is the authority on how things look, move, and respond. If a pattern isn't here, it doesn't exist yet — see "Adding a new pattern" at the end. This file documents what is **already correctly built** (do not redo it) and specifies what is **missing or under-specified** (build it exactly as written here, do not improvise).

This file is organized in three layers, same order every design system worth using follows: **foundations** (the raw material — color, type, space, motion, glass), **components** (the reusable parts built from foundations), **surfaces** (every actual page/space in the app, specified corner to corner so nothing is left to a coding agent's imagination). A component or page not covered here is a documentation gap, not license to invent — flag it.

---

## 0. The four pillars (unchanged, still non-negotiable)

1. **Atmosphere over flatness.** Every background has ambient light from orbs; every surface floats in an environment, never on a blank canvas.
2. **Warmth at the centre.** Amber/coral/orange is the default experience. Cool tones (navy, forest) are alternate full themes a user opts into, not accents layered onto the warm theme.
3. **Glass as the language of depth.** Cards, panels, modals, dropdowns, toasts are glass surfaces — but glass is a **tool for hierarchy**, not decoration on every element. §3 specifies exactly where glass is and isn't allowed, because unrestricted glass is the single most common way this aesthetic breaks (see §3.4).
4. **Inter carries the voice.** All type is Inter. JetBrains Mono only for numbers/timestamps.

---

## 1. Color

### 1.1 What's already correct — do not rebuild

The token layer in `globals.css` is mature: `--bg-base`, `--accent`/`--accent-hot`/`--accent-deep`, `--text-1` through `--text-4`, `--surface-1`, `--border-default`, and a full `--elev-*` bundle system (`flat`/`raised`/`floating`/`overlay`, each with matched shadow+blur+border) already exist and are correctly structured. `--space-do`/`-think`/`-remember`/`-explore` now resolve to four distinct warm-family hues (`#E5B41E`, `#EB4233`, `#F4A261`, `#A76011`) — CONF-02 is resolved, do not collapse them back to a single shared accent.

### 1.2 The rule

**Never write a hex value or an inline `style` color in a `.tsx` file.** Every color is a `var(--token)` reference. If the color you need has no token, that is a design-system gap — add the token to `globals.css` in the same PR and document it here, do not inline it "just this once."

### 1.3 Semantic usage map

| Token | Use for | Never use for |
|---|---|---|
| `--space-do` / `-think` / `-remember` / `-explore` | Space identity: the sidebar nav item's active state, a space's icon accent, a badge tagging which space an item came from (e.g., on the global Trash or Home feed) | Status inside a single space (see status colors below — a space color and a status color must never be the same token, even if their current hex happens to coincide) |
| `--status-overdue` / `-today` / `-upcoming` / `-done` | Task/thread status only, inside Do and anywhere a due-state chip appears | Space identity |
| `--accent` / `-hot` / `-deep` | Primary actions, focus rings, the capture button, active states that are theme-driven rather than space-driven | Space or status meaning — accent is "this is the important interactive thing," not "this belongs to X" |
| `--text-1` .. `--text-4` | Text only, by importance tier (`-1` = primary, `-4` = least important) | Icon fills, borders, backgrounds |

### 1.4 Contrast is checked, not assumed

Every text/background pairing must pass **4.5:1 for body text, 3:1 for large text (≥18px, or ≥14px bold) and for non-text UI elements** (borders that convey meaning, icon-only buttons) per WCAG 2.2 AA. This applies with extra force on glass surfaces (§3), where the "background" a text color is checked against is whatever is likely to sit behind the blur in practice, not just the flattest-case color. `--text-4` was already bumped once for exactly this reason (`DS-06`) — treat any further low-alpha text token as needing the same check before use, not after a complaint.

**Audit note (July 9, 2026):** `--text-4` and `--text-decorative` tokens currently have **0 usages** in the codebase (audit-verified) — they were problematic per DS-06 and were effectively abandoned. Do not introduce new usages without first re-verifying contrast. See `docs/project/DOCS_NEEDS_CODE.md` for removal candidates.

### 1.5 Per-space colors: derived from the theme, not hand-picked (resolves `CONF-02`/`CONF-13`, supersedes the earlier fixed-hex approach)

Per-space colors are **kept**, and are **derived**, not independently hand-picked. Four independently-chosen hex values per theme (the earlier approach) reliably produces colors that feel too similar and don't sit naturally in every theme — this is a well-documented anti-pattern, not bad luck. The correct mechanism (`DS-28`): in OKLCH (perceptually uniform, so a fixed hue rotation reads as an equally-distinct color at any lightness/chroma), each space's color is that theme's own `--accent` hue rotated by a fixed offset, with lightness and chroma held roughly constant across all four. The same offsets are used in every theme — only the base accent hue differs — so the four space colors are guaranteed to (a) look distinct from each other within a theme, by a consistent, deliberate gap, and (b) never look "out of place," because they're mathematically derived from that theme's own primary color rather than picked separately three times. Apply the result everywhere a space's identity should show: that space's `PageHeader` icon, the sidebar's active-nav-item state, and any cross-space reference badge (global Trash, Home summary cards) — a partially-applied color system is what made this feel arbitrary before.

---

## 2. Typography

### 2.1 What's already correct

A full semantic type scale already exists and should be used as-is: `--text-caption` (10px), `--text-meta` (11px), `--text-ui` (12px), `--text-body` (13px, fluid via `clamp(14px, 0.3vw + 13px, 15px)` at the base), `--text-title-sm` through `--text-title-4xl` (15px–32px), `--text-display`. **This is more mature than most projects at this stage — do not introduce a competing scale, and do not reach for an arbitrary `text-[13px]` when one of these already matches.**

### 2.2 What to add: a scale-to-usage map (currently missing — this is the actual gap)

Having a scale and knowing which class to reach for in which context are different things, and the second is what's been missing — hence "every component looks different." Use this table, not judgment, when placing type:

| Context | Token | Weight |
|---|---|---|
| Page greeting ("Good morning...") | `text-title-4xl` (Home only — this size appears nowhere else) | 500 |
| Page title (space name: "Do", "Think"...) | `text-title-xl` | 500 |
| Section header inside a page (e.g. a Do column header, a Settings section) | `text-title-md` | 600 |
| Card / list-row title (task title, person name, thread first line) | `text-title-sm` | 600 |
| Body copy (task notes, thread body, descriptions) | `text-body` | 400 |
| Secondary/meta line under a title (timestamp, category, "3 tasks") | `text-meta` | 400 |
| Button label, input label, tab label | `text-ui` | 500 |
| Uppercase eyebrow label, badge text | `text-caption`, letter-spacing `0.04em`, uppercase | 600 |
| Numbers that need tabular alignment (durations, counts, dates in the calendar grid) | `text-mono` (JetBrains Mono) | 400 |

### 2.3 Responsive type

Do not scale type per-breakpoint with `md:text-lg` chains scattered through components — the base scale is already fluid (`clamp()`) where it needs to be (`--text-base`). Titles above `text-title-lg` may need a mobile-specific step-down (a 32px display greeting is too large on a 360px viewport) — use a `clamp()` addition to the token itself in `globals.css`, not a per-component Tailwind responsive override, so every consumer of that token benefits at once.

### 2.4 `text-wrap`

Add `text-wrap: balance` to every heading-level token (`title-lg` and above) and `text-wrap: pretty` to `--text-body` at the CSS-variable/utility level, not per-component. This is a one-line, zero-risk addition (browser support is universal enough by 2026 to not need a fallback) that measurably improves how ragged lines look on both narrow and wide measures — do it once, globally, and every component inherits it.

---

## 3. Glass and elevation — Glassmorphism 2.0, not flat blur

This is the pillar with the most current, hard-won industry research behind it, and the one this project has visibly struggled with in practice — inconsistent blur, dropdown-clipping bugs, and a claim ("dropdowns, toasts are glass surfaces too") that wasn't actually true in the shipped app. Follow this section exactly; it supersedes any earlier, shallower version of this guidance.

### 3.0 The five rules of this app's specific glass language (distinct from Apple's Liquid Glass)

Apple's Liquid Glass (2025+) is specular and motion-reactive — it refracts and shifts as you move. This app's glass is **tactile and grainy**, closer to what current (2026) practice calls "Glassmorphism 2.0": frosted, textured, calm, not reflective or kinetic. Five concrete rules follow from that distinction:

1. **Alpha-gradient fills, not a flat translucent color.** A flat `rgba(x,x,x,0.1)` reads as washed-out per current guidance — every glass surface's background is a subtle two-stop gradient within the surface's own hue family, not one flat value.
2. **A grain/noise layer on every glass surface.** A small (64–128px), tileable, low-contrast noise texture, applied as a shared `background-image` at ~3–6% opacity with `mix-blend-mode: overlay` or `soft-light`. Generate this once as a static, cached asset — never compute noise live per-element or per-frame; that reintroduces exactly the performance cost this document's `PERF-04`/`PERF-08` tickets exist to remove.
3. **A specular-highlight border, not a flat single-color line.** A thin (0.5–1px) gradient border, slightly brighter along the top edge, simulating light catching a physical glass edge.
4. **Glass parity across every surface that claims it — including dropdowns and toasts, not just cards/panels/modals.** If this file says a component is glass, it must actually render that way; a stated claim that turns out not to match the shipped component (as happened here) is worse than not making the claim at all.
5. **Pills are explicitly excluded from the glass language.** Status/priority/category pills are flat, saturated, and glowing (see §7's pill spec) — a distinct visual layer that sits *on top of* glass, not a muted extension of it. Do not "fix" a pill by making it glassy; that would be wrong for this system.

### 3.1 What's already correct

The `--elev-*` bundle system (`flat` → `raised` → `floating` → `overlay`) is the right shape: each level bundles a shadow, a blur amount, and a border together so a component picks one elevation, not three independent values. `--blur-elevated: blur(24px)` exists as a named heavy-blur token rather than a magic number.

### 3.2 The barrier-layer rule (new — this is the fix for "text disappears on glass")

Glassmorphism's single most common failure, confirmed across every current source on the topic, is text contrast collapsing because it's checked against a flat mockup background instead of the actual, variable content that ends up behind the blur in production (ambient orbs, other cards, colorful task chips). The fix used by teams that ship this aesthetic at scale is a **barrier layer**: every glass surface has a solid (not transparent) low-opacity fill *underneath* the blur, so contrast is guaranteed by an opaque color, and the blur/transparency on top is purely decorative atmosphere. Concretely: `GlassCard`'s background is never `backdrop-filter` alone — it is `background: var(--surface-1)` (already near-opaque, ~5.5% white per the existing token) *composited under* the blur, not a fully-transparent pane with only a blur filter. Verify this is how `GlassCard.tsx` is actually implemented; if any glass surface in the codebase relies on blur alone with no solid fill beneath it, that surface has a latent contrast bug waiting for the wrong background to sit behind it.

### 3.3 The blur budget (performance + the "visual fog" pitfall)

Current guidance is consistent and specific: **no more than two stacked/nested `backdrop-filter` regions on screen at once**, and never nest one glass surface's blur inside another's render path (a dropdown opening from inside a glass card should not compound blur on blur). Enforce this structurally:

- Use `--elev-overlay-blur` (24px, the heaviest) only for the single topmost surface actually in focus: an open modal, an open sheet. Never on a card sitting behind it.
- `--elev-floating-blur` (dropdowns, toasts) and `--elev-raised-blur` (cards) are lighter and are the two "at once" the budget allows — a raised card behind a floating dropdown is fine; a raised card behind an overlay-blur modal behind another dropdown is not.
- `PERF-04`/`PERF-08` (already tracked) exist specifically to bring the current 16 `backdrop-filter` declarations in line with this budget — this section is that ticket's design rationale, not a new requirement.

### 3.4 Where glass is not allowed

Per current NN/g and practitioner guidance, glass is a **focal tool**, not a base material for every surface. Do not put glass on:

- Long-form reading surfaces: a Think thread's body text, an Explore article's saved content. These render on a flat `--surface-1` panel with no blur — glass behind sustained reading measurably hurts legibility and is the wrong metaphor (you don't read through frosted glass).
- Dense forms with many stacked fields (the full `TaskAddPanel`/`AddPersonPanel` body). The **sheet/panel container** may be glass (it's a floating overlay); the **input fields inside it** are opaque (`Input`/`Textarea`'s own background is `--surface-1` solid, no blur) — glass-on-glass-on-glass is illegible and is exactly the "busy background" failure mode current guidance warns about.
- Legal/critical text (delete confirmations' body copy) — `ConfirmModal`'s container may be glass; its message text sits on an inner opaque scrim.

### 3.5 Definition and affordance

Every glass surface gets a **1px border** at `--elev-*-border` — this is not optional polish, it's the accessibility mitigation current guidance calls "edge definition": without it, low-vision users and anyone on a busy background cannot tell where an interactive glass surface begins and ends. A subtle hover "shimmer" (a light gradient sweep, already partially present per `animations.ts`) reinforces that a glass surface is interactive, not just decorative — apply it to every clickable `GlassCard`, not selectively.

### 3.6 Reduced transparency and reduced motion — full fallback, not a tweak

`prefers-reduced-transparency: reduce` must swap every `--elev-*-blur` to `blur(0px)` and raise the corresponding surface to a fully opaque color (not just a higher-opacity translucent one) — this is `DS-14`, already ticketed; this section is why: the current guidance explicitly frames this as "detect the setting and swap to solid, high-contrast surfaces," not "reduce the blur amount." `prefers-reduced-motion: reduce` must remove hover-transform distance entirely (already required by `DS-14`) — the shimmer sweep and any parallax on ambient orbs must also respect this, not just card lift.

**⚠ SPEC WRITTEN, NOT YET IMPLEMENTED (DS-14 open).** Audit (July 9, 2026) confirms:
- `prefers-reduced-transparency: reduce` has **0 occurrences** in the entire codebase — not handled anywhere.
- `prefers-reduced-motion: reduce` at `globals.css:775, 1120, 1149-1168` only sets `transition-duration: 0.01ms !important` — does **NOT** remove the `transform` value. A `hover:scale-[1.01]` still scales instantly instead of not scaling. **Setting promises "no movement" but delivers "instant movement."**
- Fix: remove transform/distance for every hover/interactive animation when reduced-motion is set; add `prefers-reduced-transparency: reduce` branch that disables backdrop blur and ambient orb animation.
- See `docs/project/DOCS_NEEDS_CODE.md`.

---

### 3.7 Reference-informed refinements (sidebar, select dropdown, calendar chips)

Three concrete visual references were reviewed directly against this app's own components, not treated as generic mood-board inspiration:

- **Sidebar background** should eventually adopt the same frosted/grain treatment as every other glass surface (§3.0), rather than a flatter fill — a compact vertical icon+label menu over genuine frost, generous radius, even rhythm, is a proven, calm pattern for exactly this kind of navigation.
- **`Dropdown`'s `select` variant**, once its scroll/type-ahead gap (`BUG-31`) is fixed, should move toward a mode-picker visual: a checkmark on the active row in a simple list, rather than a different indicator style, for consistency with the platform-native pattern this app's own users already know from their phone.
- **Calendar task chips** (once the calendar rewrite starts) should use a left-border accent color plus an avatar stack, not a fully-filled colored block — calmer and more legible at a glance, and it pairs naturally with `DS-28`'s derived per-space colors, since the border communicates identity without needing to tint the whole chip.

### 3.8 The discipline principle (why `DS-15`/`DS-17` exist, not just what they enforce)

Apps praised for calm, cohesive mobile design (How We Feel is the clearest example) share one trait more than any specific color or motion choice: **restraint.** Every screen carries one primary action and uses color, decoration, or a new card treatment only when it's actually load-bearing — never "because it looked a little empty." This is not a vague aesthetic preference; it's the actual reason this app locks its Tailwind theme (`DS-15`) and requires a manifest lookup before inventing new UI (`DS-17`) — those tickets exist to make restraint the *default*, structurally, rather than something that has to be remembered on every single new screen.



## 4. Motion

### 4.1 What's already correct

`--dur-fast` (120ms) / `-base` (200ms) / `-slow` (300ms) / `-very-slow` (500ms) and `--ease-spring` / `-smooth` / `-in-out` already exist as named tokens — use them, never a bare `duration: 0.2` or a hand-picked cubic-bezier in a component file. `MotionProvider`'s `LazyMotion features={domMax} strict` + `m.*`-only convention is correct and is on the "do not break" list.

**Audit note (July 9, 2026):** `useReducedMotion` is **duplicated** — defined in both `src/hooks/useReducedMotion.ts` AND `src/lib/animations.ts:21`. Pick one and delete the other. See `docs/project/DOCS_NEEDS_CODE.md`.

### 4.2 Duration-to-context map

| Motion | Token | Notes |
|---|---|---|
| Hover feedback (card lift, button press) | `--dur-fast` + `--ease-smooth` | Gate behind `@media (hover: hover) and (pointer: fine)` — touch devices get no hover state, only active/pressed. **Cards and list rows always lift (`translateY(-2px)` to `-3px`), never scale.** A scale transform grows the element's rendered box past its layout box, which clips visibly inside any `overflow-hidden`/`overflow-x-auto` ancestor (a horizontally-scrollable Kanban column, for instance) — this produced a real, reported bug (`DS-30`). A translateY lift repositions without growing the box, so it never has this problem. Every hoverable card/row in the app uses the same lift distance, duration, and easing — this is one system, not a per-component choice. |
| Dropdown/popover open | `--dur-fast` + `--ease-spring` | Scale-from-trigger, not a generic fade |
| Sheet/modal open | `--dur-base` + spring physics (stiffness ~300, damping ~28, matching the existing `modalTransition` token in `animations.ts`) | Slide-from-edge on mobile (Sheet), scale-in on desktop (Modal) — these are different motions for different surfaces, do not use one for both |
| Page transition | `--dur-base`, opacity-only, no y-axis movement | **⚠ NOT YET IMPLEMENTED (BUG-23 open)** — no `src/app/(app)/template.tsx` exists; page-to-page is a hard cut. See `docs/project/DOCS_NEEDS_CODE.md`. This is `BUG-23`'s exact requirement |
| Toast enter/exit | `--dur-fast` in, `--dur-slow` out (linger before dismiss reads calmer than a symmetric fade) | |
| Ambient orb drift | `--dur-very-slow` and slower, looping | Must pause on `document.visibilitychange` (tab hidden) — `PERF-03` |

### 4.4 Hover magnitude standardization (audit-verified, extends DS-30)

**6 different hover magnitudes currently in codebase** — this is a fragmentation bug, not a design choice:

| Component | Current hover | Magnitude | Status |
|---|---|---|---|
| `TaskCard.tsx:233` | `whileHover={{ y: -2 }}` | 2px lift | ✓ Correct per DS-30 |
| People / Think / Explore cards | `hover:scale-[1.01]` | 1% scale | ✗ Causes cut-border due to `overflow-hidden` in GlassCard |
| People list row | `hover:scale-[1.005]` | 0.5% scale | ✗ Different from sibling card |
| Button primary | `hover:-translate-y-[1px]` | 1px lift | ✗ Different from TaskCard's 2px |
| RitualOverlay close button | `hover:scale-110` | 10% scale | ✗ Way more aggressive |
| SettingsModal theme swatch | `hover:scale-125` | 25% scale | ✗ Even more aggressive |

**Standardize on `translateY` lift only** — DS-30. Replace all `hover:scale-*` with `whileHover={{ y: -2 }}` (Framer Motion) or `hover:-translate-y-0.5` (CSS). Use the same lift distance (2px), duration (`--dur-fast`), and easing (`--ease-smooth`) for every hoverable card/row. Gate all hover-only visual treatment behind `@media (hover: hover) and (pointer: fine)`. See `docs/project/DOCS_NEEDS_CODE.md`.

### 4.5 Spring over duration-based easing for anything that feels "physical"

Current practitioner consensus (and Framer Motion's own design intent) is that spring physics reads as more natural for anything simulating a physical object (a sheet being dragged, a card settling into place) while duration+cubic-bezier easing is correct for anything simulating a state change (opacity fades, color transitions). Do not use spring physics for opacity-only transitions (it produces an uncanny "overshoot" on a property that has no physical mass) and do not use fixed-duration easing for drag-released motion (it feels stiff). `Sheet.tsx`'s drag-to-dismiss already uses spring correctly per the "do not break" list — use it as the reference implementation when adding a new draggable surface.

---

## 5. Spacing, radius, and layout grid

### 5.1 Spacing

Use Tailwind's default scale (`gap-1` through `gap-8`, `p-*`) — it is already a closed, sufficient set for this project's density. Once `DS-15` (locking the Tailwind theme) lands, arbitrary spacing values will stop compiling; until then, treat any `p-[Npx]`/`gap-[Npx]` you're about to write as a signal to pick the nearest scale step instead.

### 5.2 Radius

`--radius-xs` (4px) through `--radius-2xl` (24px) plus `--radius-full` already exist. Map by component *category*, not by feeling:

| Category | Radius |
|---|---|
| Badges, chips, pills, avatars | `--radius-full` |
| Buttons, inputs, dropdown triggers | `--radius-md` (12px) |
| Cards, list rows | `--radius-lg` (16px) |
| Sheets, modals, large panels | `--radius-xl` (20px) — matches the existing `--sheet-radius` token |
| Toasts | `--radius-lg` |

### 5.3 Layout grid

No component should hand-roll a max-width/centering pattern. Every page body is constrained the same way: a single content column, `max-width` set once at the page-shell level (`PageHeader`'s parent container), never per-section. Multi-column layouts (Do's Board view, People's grid) use CSS Grid with `auto-fit`/`minmax()` so column count is a function of available width, not a hardcoded breakpoint list — this is what lets the same component degrade gracefully from a 360px phone to a 1536px monitor without a wall of `sm:`/`md:`/`lg:`/`xl:`/`2xl:` overrides on every element.

---

## 6. Every surface, corner to corner

This is the section that was missing entirely before this pass, and it is the direct fix for "every page and component feels like its own thing." Every space/page in the app is specified here: its layout shape, its states (loading/empty/error/populated), and its responsive behavior. A page not matching its entry here is out of spec, full stop — this not being checked automatically yet is exactly what `DS-18`'s design-system-check pass is for.

### 6.1 Global page shell (applies to every authenticated page)

- `PageHeader` at the top: space icon (colored via that space's `--space-*` token) + `text-title-xl` space name + optional `text-meta` description + a right-aligned actions slot (primary "Add" button lives here, always).
- Below the header: the page's content region, in a single scrollable column on mobile, optionally multi-column on desktop per §5.3.
- Every page's **primary creation action** (the button in `PageHeader`'s actions slot) and every page's **empty-state creation action** (`EmptyState`'s `action` prop) call the exact same handler — this is `BUG-04`/`BUG-24`'s permanent rule, not a one-time fix. If a new page is added, its empty state's button target is checked against its header button target as part of that page's own PR, not as an afterthought ticket later.
- Loading state: `Skeleton` rows matching the shape of the content about to appear (a task-list skeleton looks like task rows, not a generic spinner) — never a bare `LoadingSpinner` as the *only* loading treatment for a list-shaped page; `LoadingSpinner` is for actions (a button's in-flight state), not for page-level content loading.

### 6.2 Home (`/`)

- Greeting (`text-title-4xl`, time-of-day aware) at the top — the one place this size is used.
- A single-column stack on mobile; a 2-column layout on `lg:` and above (today's tasks + upcoming meetings on one side, recent threads + stale explores on the other) using CSS Grid, not fixed pixel widths.
- Each section ("Today", "Recent Threads", "Stale Explores") is its own `GlassCard` at `raised` elevation — Home is the one page allowed to show several glass cards side-by-side, because they're short, scannable summaries, not the long-form content §3.4 restricts.
- Empty sections render `EmptyState` at a **compact** size (icon + one line, no illustration) — Home's whole point is a fast overview; a full-height empty-state illustration in one of four stacked sections is disproportionate.

### 6.3 Inbox (`/inbox`)

- A flat list of `InboxItemCard`s, each with a "Route it" action opening a `Popover` (portal-based, per `BUG-03`/`BUG-27` — this is the exact surface that regressed once; any change here ships with the regression-guard screenshot `MD` §14.5 already requires).
- Swipe-left-to-route on mobile is the touch equivalent of the desktop dropdown — both must offer the identical five destinations in the identical order.
- Empty state ("Inbox Zero") is the **one documented exception** where the empty-state action correctly opens Quick Capture (`CaptureModal`) rather than a space-specific panel, because Inbox's entire purpose is to receive arbitrary captures — see `BUG-24`.

### 6.4 Do (`/do`) — Board / Today / Calendar

- View switcher (`SegmentedControl`, not three separate buttons) selects Board / Today / Calendar; persist the choice per `INT-02`/`TOOL-04` (URL query param, so it's shareable and survives back-navigation, with `user_settings` as the cross-device fallback default).
- "Show Archive" is a **tab** (Active / Archive / Trash), not a standalone toggle button — this is now settled (`DS-24`): Think and Explore both already converged on the tab pattern independently, and Do's separate toggle-button treatment is the one that needs to change to match, not the reverse.
- **Board view:** columns are Overdue / Today / Upcoming / Someday, each tinted by its `--status-*` token (not a space token — see §1.3), laid out with CSS Grid `auto-fit` so column count degrades from 4-across on desktop to a horizontally-scrollable single-column-at-a-time carousel below `md:`, with visible peek of the next column (never a hard-cut single column with no affordance that more exists).
- **Today view:** single flat list, grouped by time-of-day if the task has a time, otherwise an "Anytime" section at the bottom.
- **Calendar view:** see §6.4.1 — **⚠ CONF-08 unresolved, calendar rebuild not started.** Current Calendar view (`src/components/features/calendar/`) is the old flexbox implementation flagged for rebuild. See `docs/project/DOCS_NEEDS_CODE.md`.
- Every task row (`TaskCard`) is swipeable on touch (complete right, delete left, asymmetric thresholds per `MOB-03`) and has visible inline actions on hover for pointer input — both paths must produce the identical result (same status transition, same undo toast).

#### 6.4.1 Calendar sub-spec (⚠ SPEC WRITTEN, NOT YET IMPLEMENTED — awaits `CONF-08` resolution)

- **Mobile default is Day view**, not a compressed Week view — a single scrollable column of hour slots, current-time indicator, tap-to-create at any slot opening `TaskAddPanel` with that exact date/time pre-filled (never routed through Quick Capture's NLP parser — this was `BUG-05`'s specific, confirmed defect).
- **Week/Month are desktop-first views**, built on CSS Grid so header cells and body cells share the same grid definition and cannot desync on horizontal scroll (this is the structural reason a rebuild was recommended over patching the old flexbox layout).
- Every interactive cell and every task chip is keyboard-reachable (`tabIndex`, arrow-key navigation between adjacent slots) — this was previously entirely absent.

### 6.5 Think (`/think`)

- A list of thread previews (`text-title-sm` first line + `text-meta` timestamp), each opening a full thread view (`/think/[id]`) with a `Textarea`-based composer at the bottom, sticky above the mobile keyboard (`useVisualViewport`, matching `Sheet`'s existing keyboard-avoidance pattern).
- Thread body content renders on flat `--surface-1`, no glass, no blur (§3.4) — this is sustained reading, not a card.
- Search uses `SearchInput` (currently built, zero adoptions — `DS-05`/`TOOL` gap) with debounced filtering, not a full-page reload.

### 6.6 Remember — People (`/remember/people`) and Locations (`/remember/locations`)

- People renders as a responsive card grid (`Avatar` + name + `text-meta` last-contact date), `auto-fit`/`minmax(180px, 1fr)` so it's 2-across on a phone and up to 5–6 across on a wide desktop with zero breakpoint-specific column-count classes.
- Locations renders as a list (address-first content doesn't benefit from a grid the way an avatar-first list does) with a map-pin icon per row, tinted `--space-remember`.
- Both share one add panel pattern (`AddPersonPanel` / `LocationAddPanel`, both `Sheet`-based) and one delete/restore flow (`item-lifecycle.ts`'s `moveItemToTrashPatch`/`restoreItemPatch` — per `BUG-08`'s resolution, People and Locations get the same soft-delete/undo treatment as every other entity, not the historical hard-delete-only behavior).

### 6.7 Explore (`/explore`)

- A single-column reading queue, each item a compact card (thumbnail if present, title, source, saved-date) — **not** glass (§3.4; this is a reading list, treat it like Think's thread body).
- The Type field (**⚠ still a native `<input>` + `<datalist>` per `ExploreDrawer.tsx:258` — BUG-25/33 NOT YET fixed**) becomes a `Dropdown variant="select"` — this single change is the concrete instance of the broader rule "never use `<datalist>` or native `<select>` anywhere in this app," which belongs in this file precisely so it isn't rediscovered per-component. See `docs/project/DOCS_NEEDS_CODE.md`.
- 30-day auto-archive is a background/data behavior, not a visual one — the visual difference between "active" and "archived-by-age" Explore items is a `text-meta` label ("Archived · 32 days ago"), not a different card treatment.

### 6.8 Trash (`/trash`)

- One flat list across all five entity types (`items`, `people`, `threads`, `explores`, `locations`), each row showing which space it came from via a small `Badge` in that space's `--space-*` color — this is the one place cross-space color-coding earns its keep, since the whole point of this page is "what did I delete, from where."
- Two actions per row: Restore, Delete permanently (routes through `ConfirmModal` — a second, harder confirmation for a second, harder-to-reverse action).
- Empty state: "Nothing in trash" — genuinely the one page in the app where an empty state is unambiguously good news; its copy and icon should read that way (not the same "you're all caught up" tone used for a cleared task list, which is a *different* feeling — a full Do list caught up is an accomplishment, an empty trash is just neutral housekeeping).

### 6.9 Settings

- A single `Sheet`/modal (not a routed page — this remains the settled decision per the skip list; do not build `/settings` as a route).
- **Time-based settings are two concepts, not four (⚠ `CONF-14` RESOLVED but NOT YET IMPLEMENTED):** a morning ritual time and an evening ritual time, matching `rituals.ts`'s own two-ritual model exactly — the settings UI should mirror what the code actually reasons about. Do not expose a separate "Quiet Hours" setting; that's a notification/do-not-disturb concept, and the domain's own reference point for this app's ritual system (Sunsama) doesn't have one either — it belongs to the OS's notification settings if it's ever needed at all, not to this app. **Current state:** `SettingsModal.tsx:1026,1039,1303,1323` still has 4 `type="time"` inputs (Quiet Start/End + Morning Nudge/Evening Shutdown) and `:1417` has 1 native `<select>` for Auto-Archive Completed (BUG-43). Migration to 2 ritual-time pickers + `Dropdown variant="select"` tracked in `docs/project/DOCS_NEEDS_CODE.md`.
- **Timezone is auto-detected, not a primary setting:** default from `Intl.DateTimeFormat().resolvedOptions().timeZone` silently; only surface a manual override inside an "Advanced" section for the rare case someone needs it, not alongside the two ritual times.
- Sectioned with `text-title-md` section headers (Account, Appearance, Notifications, Data), each section a flat list of rows (label left, control right — toggle, `Dropdown`, or button), not individually-cased glass cards per row (that's over-fragmenting a single coherent surface into visual noise).
- Theme picker shows the three themes (Warm/Navy/Forest) as swatches previewing each theme's actual `--accent`/`--bg-base` pair, not a text-only radio list — a color choice should be shown, not described.
- Must scroll correctly regardless of which page it's opened from (`BUG-11`/`T0-6`, confirmed fixed via `useBodyScrollLock` + Lenis's `data-overlay-open` check — this is now a "do not break" invariant, not an open bug).

### 6.10 Onboarding and Login

- Both are **public routes**: theme is always the literal default (`warm`/`dark`), never read from `localStorage` (`BUG-15`, confirmed fixed) — this file exists partly so a future onboarding redesign doesn't reopen that exact bug by adding a new place that reads a stored preference before authentication.
- Onboarding's ambient background uses the same orb/token system as the in-app `AmbientBackground`, not a separately hardcoded palette (`BUG-21`) — one atmosphere system, two mount points, not two systems.
- Login's card is the one place a glass surface sits directly on the raw ambient background with no other content behind it — this is exactly the "simple background, glass only on the focal element" case current guidance holds up as glass done right, so this screen is closer to the ideal than most others and should be treated as a reference example when reviewing other pages' glass usage.

### 6.11 Page-to-page transitions

Per `BUG-23`: one shared, opacity-only fade (`--dur-base`, no y-axis movement) applied uniformly via a single shared transition wrapper for the `(app)` route group — not a per-page bespoke animation, and not zero animation on some pages and a fade on others.

**⚠ NOT YET IMPLEMENTED (BUG-23 open)** — no `src/app/(app)/template.tsx` exists; page-to-page is a hard cut. See `docs/project/DOCS_NEEDS_CODE.md`.

---

## 7. Components — canonical reference

For each: what it's for, its variants, and the one rule most likely to be violated. Full prop tables live in `COMPONENT_MANIFEST.md`; this section is the *why*, that file is the *what*.

**Button** — every clickable action in the app. Variants: `primary` (one per screen, max), `secondary`, `ghost`, `destructive`, `outline`, `link`. Sizes include a dedicated `icon`/`icon-sm`/`icon-lg` set whose *hit area* is 44×44px minimum even when the visual glyph is smaller (per `--touch-target` token, per `DS-09`/WCAG 2.2's target-size success criterion) — pad the hit area, don't shrink the requirement.

**Input / Textarea / SearchInput** — every text entry. Always paired with a visible `label` (not a placeholder-as-label — placeholder text disappears the moment a user starts typing, which is a documented WCAG failure mode for anyone with short-term memory or attention differences). Error state shows inline text wired to `aria-invalid`/`aria-describedby`, not a toast-only error (`A11Y-06`).

**GlassCard** — see §3 in full. Two variants only: `list` (flat, no blur — for rows in a scrollable list, where per-row blur would multiply straight past the §3.3 budget) and `elevated` (blur, for standalone cards, modals, the sidebar). Do not add a third variant without checking whether it's actually one of these two with different padding.

**Dropdown / Popover** — every menu, select, and combobox. Portal-based (`createPortal`), not optional (`BUG-03`/`BUG-27`, "do not break" list). Keyboard: arrow keys move selection, `Enter` commits, `Escape` closes and returns focus to the trigger.

**Sheet** — every mobile-width modal-like surface. Drag-to-dismiss from a dedicated handle (not the whole sheet body, which would fight with a focused input's own touch handling), `useVisualViewport`-aware so the keyboard never covers the active field, snap points (half/full) for content that has a natural "peek" state (`MOB-03`/`T3`).

**ConfirmModal** — every destructive or hard-to-reverse action. Never `window.confirm`.

**EmptyState** — every zero-content condition, phrased for that specific space (§6's per-page notes on tone — "all caught up" reads differently from "nothing in trash").

**PageHeader** — every page's top region, per §6.1.

**Badge / Avatar / Toast** — status/identity tagging, person representation (with a guaranteed non-empty fallback — `BUG-10`'s permanent fix), and the one undo/notification mechanism respectively.

---

## 7.5 Theme × mode readability matrix (audit-verified, July 9, 2026)

**6 theme×mode combos** exist in `globals.css:98-590`. Audit verified each:

| Theme | Dark mode | Light mode |
|---|---|---|
| Warm | ✓ High contrast (white `#FFFFFF` on near-black `#0F0A00`, accent `#E5B41E` amber) | **✗ BROKEN — `globals.css:336-420` does NOT override `--text-1/2/3/muted/decorative/on-accent`; they stay at dark-mode `#FFFFFF` → white text on cream `#FBF6EE` = unreadable. ROOT PATTERN 2, P0 bug.** |
| Navy | ✓ High contrast (white on deep blue-black `#04091A`, accent `#7692FF` periwinkle) | ✓ Correct (dark navy text `#040930` on pale blue `#EEF3FF`, accent `#1B2CC1` deep blue) |
| Forest | ✓ High contrast (white on deep forest `#080D06`, accent `#EFDD8D` warm yellow) | ✓ Correct (dark green text `#0D1A08` on pale green `#F5F9F0`, accent `#4A5C1E` deep green) |

**Only warm-light is broken.** Navy-light and forest-light correctly override text colors — warm-light is an oversight, not a systemic issue. Fix: copy navy-light's text-override pattern (`globals.css:500-528`). See `docs/project/DOCS_NEEDS_CODE.md`.

### 7.6 Hardcoded hex audit (audit-verified, extends DS-02)

**99 hardcoded hex values** in `.tsx` files break theme switching. Each one is a tokenization ticket.

**Top offenders:**

| File | Count | Examples |
|---|---|---|
| `SettingsModal.tsx` | 19 | Various UI accents |
| `OnboardingBackground.tsx` | 12 | Radial gradient hex (BUG-21 partially open) |
| `remember/people/[id]/page.tsx` | 10 | Person detail UI |
| `think/[id]/page.tsx` | 9 | Thread detail UI |
| `AddPersonPanel.tsx` | 7 | Avatar colors `#3B82F6`/`#10B981`/etc. (intentional user-pickable palette but bypasses theming) |
| `CaptureModal.tsx` | 5 | `#4ADE80` (locations), `#FBBF24` (inbox) |
| `PomodoroTimer.tsx` | 3 | `#2DD4BF`/`#818CF8` break-phase colors — should be `--status-upcoming`/`--status-someday` |
| `CalendarTaskChip.tsx` | 3 | `#ef4444` priority 1 — should be `--status-overdue` or new `--priority-1` token |

**Rule:** Never write a hex value or an inline `style` color in a `.tsx` file. Every color is a `var(--token)` reference. If the color you need has no token, that is a design-system gap — add the token to `globals.css` in the same PR and document it here, do not inline it "just this once." See `docs/project/DOCS_NEEDS_CODE.md` for the full tokenization plan.

## 8. Responsive and mobile system

This section exists because "mobile responsive" was named directly as a priority and because current research is explicit that treating mobile as a shrunk desktop layout — rather than the primary designed experience — is the most common way a responsive app still feels broken on a phone even when it "technically" resizes.

### 8.1 Breakpoints

Tailwind defaults, used mobile-first (unprefixed = phone, `md:` = the point the sidebar switches from `BottomNav` to the hover-rail, `lg:` = desktop multi-column layouts activate per §6's per-page specs):

| Prefix | Min-width | What changes here |
|---|---|---|
| (none) | 0 | `BottomNav`, single-column everything, Calendar defaults to Day view |
| `sm:` | 640px | Minor spacing increases only — this step rarely changes structure |
| `md:` | 768px | Sidebar (hover-rail) replaces `BottomNav`; Do's Board view gains its first extra visible column |
| `lg:` | 1024px | Home's two-column layout activates; Do's Board reaches full 4-column width |
| `xl:` / `2xl:` | 1280px / 1536px | Content max-width caps, no new structural changes |

### 8.2 Touch targets and thumb reach

Every interactive control is **44×44px minimum** hit area (`--touch-target` token — already exists, apply it everywhere it currently isn't, per `A11Y-01`/`DS-09`). On mobile layouts specifically, primary actions (the capture button, a view's main "Add" action) sit in the **bottom two-thirds of the viewport** — the zone reachable by a thumb without a grip shift — which is already satisfied by `BottomNav`'s placement and should be checked for any new primary action before it ships at the top of a mobile screen.

### 8.3 Safe areas

`viewport-fit: cover` plus `env(safe-area-inset-*)` on every fixed-position edge element (`BottomNav`'s `pb-safe`, a full-screen `Sheet`'s top inset) — already partially applied; extend to any new fixed-position element rather than reintroducing the un-inset pattern.

### 8.4 Viewport height

`100dvh` (dynamic viewport height), never bare `100vh`, on every full-height container — `100vh` on mobile Safari/Chrome includes space the browser chrome may or may not be occupying, which is the direct mechanism behind "the sheet is taller than the screen" bugs. `100svh` (smallest viewport height) for anything that must never be covered even in the worst-case browser-chrome state (a persistent bottom action bar).

### 8.5 Gesture parity, not gesture exclusivity

Every gesture-driven interaction (swipe-to-complete/delete on `TaskCard`, drag-to-dismiss on `Sheet`) has a pointer/keyboard equivalent that produces the *identical* result — a mouse user or a keyboard user is never blocked from an action only a touch user can reach. This is both an accessibility requirement (WCAG operability) and a plain functional one, since this app is also used on desktop.

### 8.6 Hover is an enhancement, not a dependency

Nothing critical is revealed only on `:hover` (inline row actions that only appear on hover must also have a persistent, tappable affordance — typically the row itself opening a detail view, or a persistent low-emphasis icon rather than one that only renders on pointer-hover). Gate all hover-only visual treatment behind `@media (hover: hover) and (pointer: fine)` so touch devices don't inherit a half-working hover state that never resolves.

### 8.7 One-handed layout bias

Mobile-first here means literally starting each new page's layout at 360–375px width and adding structure as width increases (per §8.1), not designing at desktop width and letting Tailwind's responsive prefixes strip things away — the second approach is exactly how a "technically responsive" page still ends up feeling like a shrunk desktop site, which current guidance calls out by name as the most common mobile-first failure.

---

### 8.8 Mobile viewport safety (audit-verified, July 9, 2026)

**7 `h-screen` instances** cause layout jumps on mobile Safari/Chrome when the URL bar shows/hides on scroll. Should be `h-dvh` (dynamic viewport height). `100vh` on mobile includes space the browser chrome may or may not be occupying — the direct mechanism behind "the sheet is taller than the screen" bugs.

**Locations:**
- `OnboardingBackground.tsx:145,166`
- `Navigation.tsx:72`
- `not-found.tsx:5`
- `OnboardingWizard.tsx:235`
- `~offline/page.tsx:7`
- `(auth)/login/page.tsx:61`

**BUG-41:** `Input.tsx` uses `.input` CSS class which inherits `--text-body: 13px`. iOS Safari auto-zooms on inputs <16px on focus. Fix: `@media (max-width: 768px) { .input { font-size: 16px !important; } }`. Vercel's own guideline states this plainly: `<input>` font size must be ≥16px on mobile.

**BUG-36/39:** `Sheet.tsx:58` `drag="y"` on whole sheet surface with no `dragListener={false}` or dedicated handle. Framer Motion's drag recognizer competes with nested button taps. Affects 7 consumers: ConfirmModal, AddPersonPanel, SearchModal, TaskAddPanel, CaptureModal, ExploreDrawer, LocationAddPanel. Fix: dedicated drag handle + `dragListener={false}`. Or adopt Vaul (TOOL-10).

**23 `backdrop-filter` declarations** in `globals.css`, 0 `contain: paint`. Each is a GPU layer; compounds on mobile. See §3.3 blur budget.

See `docs/project/DOCS_NEEDS_CODE.md` for the full mobile-fix plan.

## 9. Accessibility baseline (cross-reference, not a duplicate)

Full tickets live in `EXECUTION_SPEC.md`'s `A11Y-*` series. The design-relevant summary: 4.5:1 text contrast everywhere (§1.4), 44px touch targets everywhere (§8.2), every icon-only control has an `aria-label`, every dialog traps and returns focus, every realtime UI change has a corresponding `aria-live="polite"` announcement, and color is never the only signal (a status pill carries an icon as well as a color, per `A11Y-09`).

---

## 9.5 Onboarding flow state (audit-verified, July 9, 2026)

`src/app/onboarding/OnboardingWizard.tsx` — 416 lines, 5 steps (name → struggles → day shape → first capture → tour).

**Current state:**
- **11 unchecked Supabase mutations** (BUG-38) at lines 79, 102, 128, 157, 167, 169, 176, 183, 189, 213 (+1). A brand-new user's very first experience could silently fail at any step.
- **0 skip logic** on steps 1-4 (only step 5 has "Skip tour").
- **0 resume logic** — closed browser = restart from step 1.
- **0 progress indicator** (no 5-dots-at-top showing current step).
- **0 keyboard navigation** (Enter to advance, Backspace to go back — mouse-only).
- Step transitions use Framer Motion `initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}}` per step (good baseline). Step 5 has `scale:0.95` (celebratory feel).

**Spec for fixes:**
- Add Skip option on every step (sensible defaults: name="Friend", struggles=[], day shape=9am-10pm).
- Add Resume logic — persist current step to `localStorage` (`presense_onboarding_step`).
- Fix unchecked mutations — every `await supabase.from(...)` must destructure `{ error }`.
- Add copy that excites — warmer welcome ("Welcome to your second brain. What should I call you?").
- Add first-capture delight — animate destination badge (pulse + accent color) to confirm "I understood you."
- Add progress indicator — 5 dots at top.
- Add "Why we ask" tooltips for struggles + day shape questions.
- Add keyboard navigation — Enter to advance, Backspace to go back.

See `docs/project/DOCS_NEEDS_CODE.md`.

## 9.6 Empty-state coverage matrix (audit-verified, July 9, 2026)

**`EmptyState` component** exists at `src/components/ui/EmptyState.tsx` (30 lines) — uses `GlassCard` with `p-12` dashed border.

| Space | Uses `EmptyState`? | Action target correct? | Notes |
|---|---|---|---|
| Do (3 instances) | ✓ | ✓ (fixed earlier, BUG-04) | Board / Today / Calendar empty states |
| Inbox (1) | ✓ | ✓ (documented Quick Capture exception) | "Inbox Zero — nice work" celebratory tone |
| Home (multiple) | ✓ | n/a | Compact empty sections |
| People (1) | ✓ | ✓ | Correct |
| Trash (1) | Different pattern | n/a | "Nothing in trash" — neutral tone |
| Think | ✗ Hand-rolls `<h3>No threads yet</h3>` at `think/page.tsx:279` | ✗ Opens Quick Capture (BUG-35) | Should open new-thread composer |
| Explore | ✗ Hand-rolls `<h3>Nothing saved yet</h3>` at `explore/page.tsx:272` | ✗ Opens Quick Capture (BUG-35) | Should open Save-to-Explore panel |
| Locations | ✗ Hand-rolls `<h3>No locations here</h3>` at `locations/page.tsx:126` | n/a | Should use `EmptyState` (BUG-40) |
| SearchModal (filtered) | ✗ Hand-rolls "No results" | n/a | Should use `EmptyState` filtered variant |

**0 first-time-user variant** — all empty states are the same regardless of whether it's a brand-new user or an existing user who filtered to empty. A first-time student should see "Welcome to [Space] — here's what to do first" not just "No items."

**EmptyState padding inconsistency:** component hardcodes `p-12`, but Home uses `p-6`/`p-8`. Pick one.

See `docs/project/DOCS_NEEDS_CODE.md` for the migration plan.

## 10. Adding a new pattern

1. Check §7 and `COMPONENT_MANIFEST.md`. If an existing component covers it with a new variant/prop, extend that component — do not create a sibling.
2. If genuinely new: prototype it honoring §1–§5's tokens exactly (no new hex values, no new arbitrary spacing, no new blur amount outside the `--elev-*` bundles).
3. Add it to `COMPONENT_MANIFEST.md` with its variants and one canonical usage example, and add a short entry to §7 of this file, in the same PR that introduces it. A new component without both updates is an incomplete PR — this is the rule `DS-17`/`DS-18` make machine-checkable; this file is what a human (or a careful agent) checks by hand until that automation exists.
