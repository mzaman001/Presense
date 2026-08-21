# design.md — Presense design system (remake)

> This replaces the prior `design.md`. That version deferred to the existing implementation as authoritative. This one doesn't — the existing implementation is the thing that needs to change. Everything below is a concrete target, not a pointer to what already exists.

## 0. Why this is a full rewrite, and what's actually wrong

The previous pass through this repo treated `docs/project/DESIGN_SYSTEM.md` and the current `globals.css` as settled and correct, and wrote `design.md` as a thin companion layer on top. That was the wrong call once the actual product is the complaint. Below is the specific, code-level diagnosis — not "it feels off," but where, so the fix is traceable and the next agent doesn't have to take this on faith.

| Complaint | Where it actually lives | What it is |
|---|---|---|
| "Glowing in every component" | `globals.css:152,263,447,474,506,512,599,605` (`--accent-glow`, `--shadow-accent-glow` per theme) + `TaskCard.tsx:308`, `RitualOverlay.tsx:74,208,837,991,1072,1523,1544,1561` | A `0 0 Npx` blurred colored box-shadow token applied to cards, buttons, and overlay panels on hover/focus/priority. This is a named, catalogued AI-generation tell as of 2026 — "glowing card borders" and an "animated accent-glow" are called out specifically as the signature look of AI-agent-generated UI (unslop-ui and multiple 2026 design-slop teardowns identify this exact pattern). It reads as generic because it *is* the statistically default choice, not because glow is inherently bad. |
| "The logo is ugly as fuck" | `public/icon.svg` | Two overlapping radial-gradient circles (amber → coral) blended with `screen` mode on a dark rounded square, plus a grain filter. This is, almost literally, the "gradient-filled rounded square with a soft blob" pattern named directly as the default output of every 2026 AI icon generator. It needs to be replaced, not tuned. |
| "Dropdown menus are broken and inconsistent" | `Dropdown.tsx` and `Popover.tsx` each hand-roll their own `useFloating` wiring; `CaptureModal.tsx` and `calendar/MonthView.tsx` each have a *third* and *fourth* bespoke absolute-positioned menu that goes through neither | Four independent menu implementations in one app, with no shared source of truth for open/close, positioning, or keyboard behavior. `@base-ui/react` — already a direct dependency, already used for `Button` — ships a dedicated, accessibility-complete `Menu` primitive and `Select` primitive built exactly for this. Nothing in this app should be hand-rolling `useFloating` for a menu anymore. |
| "Icons are ugly and don't match the calm/meditative look" | `Icon.tsx` wraps `lucide-react` everywhere | Not a quality problem with Lucide as a library — a distinctiveness problem. Lucide is now the default icon set baked into shadcn/ui, every AI coding agent, and most starter templates; multiple 2026 icon-library comparisons state plainly that Lucide's ubiquity itself is what makes it read as a template signal now, not its line quality. It also only has one stroke weight, so there's no way to make an icon feel soft/light versus emphasized without faking it with opacity. |
| "Fonts and sizes are weird" | `layout.tsx` (Inter + JetBrains Mono only) and `globals.css:292-303` | Two real problems, not one: (1) Inter is independently named, across nearly every 2026 "how to spot AI-generated UI" writeup, as *the single most common tell* — more reliable than the purple gradient. (2) The scale itself has quiet duplication and cramped floors: `--text-xs` and `--text-caption` are both hardcoded to 10px under two different names, `--text-meta` sits at 11px, and body text floors at 13px — three near-identical tiny sizes with no clear single source of truth for "smallest legible size," which is exactly what "weird" feels like in practice even if no individual value is technically wrong. |
| "Distinct yet consistent spaces" not landing | Space colors already exist (`--space-do/think/remember/explore`) but nothing else about a space currently varies — same card, same icon weight, same motion, same empty state pattern everywhere | The current system tried to solve "distinct" with color alone. Color is doing 100% of the identity work and 0% of it is coming from shape, icon treatment, or motion — so it reads as "four colors of the same screen," not four distinct spaces. |
| Mobile, motion, and "the site doesn't feel alive" | No systematic reduced-motion-respecting micro-interaction layer; hover/press states exist per-component with no shared vocabulary | Confirms directly with the diagnosis above: there's no *named* motion system at all comparable to the color/spacing token layers, so "life" was left to whichever component author remembered to add a transition that day. |

Every fix below is a direct response to one of these rows, not a generic redesign pass.

---

## 1. Product philosophy — sharpened

Presense organizes a life into four calm spaces — **Do**, **Think**, **Remember**, **Explore** — plus an **Inbox**. The register is a quiet room at first light: warm, unhurried, textured but not decorated, alive but never loud. The previous framing of this was directionally right; the execution betrayed it. "Calm" was implemented as "dim and glowing," which is not calm — it's the aesthetic of a crypto dashboard at 2am. Real calm looks more like Things 3, Craft, or a well-made analog planner: confident materials, generous whitespace, one clear focal point per screen, and restraint everywhere else.

**We never do this — revised and made concrete:**

- **No blurred colored glow, anywhere, on anything, in any state.** Not on hover, not on focus, not on priority indicators, not in onboarding. If a state needs emphasis, it gets a color or weight change on the element itself (a filled dot, a border-color shift, a background-tint shift) — never a soft light bleeding outward from behind it. This kills `--accent-glow`/`--shadow-accent-glow` and every inline `boxShadow` that uses `0 0 Npx` outright; see §4.
- **No default shadcn/Lucide/Inter stack left unedited.** All three are fine tools; none of the three is allowed to be the *unexamined* default here anymore, because unexamined-default is precisely what makes software look AI-written in 2026. See §5–6 for the replacements and the reasoning.
- **No gradient-blob logo.** See §10.
- **No second (or third, or fourth) implementation of the same interactive pattern.** One `Menu`. One `Select`. One `Popover`. One `Sheet`. If a screen needs a menu and the shared primitive doesn't fit, the primitive gets extended — a new bespoke absolute-positioned `<div>` in a feature file is never the answer. See §8.
- **No motion with no intent.** A fade-up-on-scroll with a 0.1s stagger applied to every card on every page — the literal named "Framer Motion default" that saturates AI-generated React output — is banned. Motion here either communicates state (something opened, something was added, something completed) or it doesn't happen. See §7.
- **No urgency by stacking signals.** One deliberate color change is calmer, and more legible, than a color plus a badge plus bold text plus a shake.
- **No decoration that isn't load-bearing**, still true, still the mechanism behind everything above actually working together instead of becoming its own new pile of rules.

---

## 2. Foundational libraries — consolidated onto one primitive vendor

| Layer | Was | Now | Why |
|---|---|---|---|
| Menus, selects, comboboxes | `Dropdown.tsx` (raw `@floating-ui/react`), `Popover.tsx` (raw `@floating-ui/react`), plus two more hand-rolled instances in feature files | **`@base-ui/react/menu`** for action menus, **`@base-ui/react/select`** for value pickers, **`@base-ui/react/popover`** for anything else that floats | Base UI already ships an accessibility-complete `Menu` (arrow-key roving focus, typeahead, Escape-returns-focus-to-trigger, submenu support) and `Select` — the exact primitives this app is currently reimplementing by hand, worse, four separate times. `@base-ui/react` is already a direct dependency (it backs `Button`), so this isn't a new library, it's finishing adopting the one that's already here. |
| Dialogs/sheets | `Sheet.tsx` + `useDialogFocus` | **Unchanged** — this is the one part of the current system that's genuinely well built (real focus trap, restoration, `role="dialog"`) and should be the template the Menu/Select migration is held to, not something being replaced. |
| Component styling | shadcn/ui `base-nova` style | **Unchanged**, still the right call — it's the current, officially-supported shadcn style built specifically for Base UI. |
| Icons | Lucide via `Icon.tsx` | **Phosphor Icons** via a rebuilt `Icon.tsx` wrapper — see §6 |
| Motion | Framer Motion, ad hoc per component | **Framer Motion, unchanged as the engine**, but consolidated into a small named set of motion tokens instead of ad hoc values — see §7 |

**The extend-vs-fork rule stands as before:** check the manifest, extend the shared primitive in the same PR if it's close, only build new in `src/components/ui/` (registered, documented) if genuinely nothing fits. A feature file reaching for its own `useFloating` call is the one thing that should now fail review outright.

---

## 3. Color and elevation — same warm/navy/forest system, glow removed

Keep the existing OKLCH-derived three-theme architecture (`warm`/`navy`/`forest`, each with dark and light modes) — that part of the system is sound and doesn't need to change. What changes is how *emphasis* is expressed, because glow was doing that job and glow is gone.

**Replace `--accent-glow`/`--shadow-accent-glow` with a plain elevation ladder — no color, no blur radius beyond what a normal soft shadow needs:**

| Token | Use | Shadow (dark mode reference) |
|---|---|---|
| `--elev-flat` | Resting card, list row | none — surface color and a 1px border do all the work |
| `--elev-raised` | Hovered card, active dropdown trigger | `0 1px 2px rgba(0,0,0,0.24)` — a real, close, unblurred contact shadow, not a light source |
| `--elev-floating` | Open menu, popover, tooltip | `0 4px 16px rgba(0,0,0,0.32)` |
| `--elev-overlay` | Sheet, modal, dialog | `0 12px 40px rgba(0,0,0,0.4)` |

None of these change color per theme — a shadow is a shadow, it should never tint amber/navy/forest, because a colored shadow *is* a glow by another name. Emphasis on an interactive element (a selected priority, an active nav item, a focused input) is communicated by **background-color, border-color, or a small filled indicator dot** — never by a halo. `TaskCard.tsx`'s priority indicator becomes a solid 6px dot in the priority color, full stop, no `boxShadow: priorityGlow`.

---

## 4. Typography — Inter is out, here's the replacement stack

Three faces, one job each, chosen specifically because none of them is the default-safe choice:

| Role | Face | Why this one |
|---|---|---|
| UI and body (everything, most of the time) | **Plus Jakarta Sans** (variable, Google Fonts) | Repeatedly and specifically recommended, across current 2026 typography guides, as the right move for productivity apps that want "professionalism with approachability" without Inter's now-generic-by-ubiquity neutrality — it's geometric enough to stay calm and legible at small sizes but has real humanist warmth in its terminals that Inter's stricter grotesque construction doesn't carry. Self-host via `next/font/google` exactly as Inter is today — zero infrastructure change, one import swap. |
| Display — reserved for a genuinely small set of moments: the Home greeting, onboarding headlines, empty-state headlines | **Fraunces** (variable, optical-size axis, Google Fonts) | A soft, slightly irregular "wonky" serif built for screens, with real character at large sizes — the closest free variable font to the warm editorial-serif quality in the moodboard referenced for this brief, without importing a second UI-weight face that would fight Plus Jakarta Sans at body sizes. Fraunces is explicitly *not* used below 24px — its low-contrast strokes are part of its charm at display size and a liability at paragraph size. |
| Numerals, timestamps, code | **JetBrains Mono** | Unchanged — no reason to touch this, it was never the problem. |

**The type scale is rebuilt, not patched**, to remove the duplicate-under-different-names problem (`--text-xs` and `--text-caption` both silently being 10px):

| Token | Size | Line-height | Weight | Use |
|---|---|---|---|---|
| `--text-display` | 40px / 2.5rem | 1.05 | 500 (Fraunces) | Home greeting only |
| `--text-title-xl` | 28px | 1.15 | 600 | Onboarding headline, empty-state headline |
| `--text-title-lg` | 22px | 1.2 | 600 | Page/section title |
| `--text-title-md` | 18px | 1.3 | 600 | Card title, modal title |
| `--text-body-lg` | 16px | 1.5 | 400 | Think's editor body |
| `--text-body` | 15px | 1.5 | 400 | Default UI body — the floor for anything a user reads as content |
| `--text-body-sm` | 13px | 1.45 | 400 | Secondary metadata, list captions |
| `--text-label` | 12px | 1.3 | 500 | Form labels, tab labels, buttons |
| `--text-micro` | 11px | 1.3 | 500 | The single smallest size in the system — timestamps, tiny badges. Nothing goes below this. |

One smallest size, one name for it. `--text-xs`, `--text-caption`, `--text-meta`, and `--text-ui` are retired — every current usage maps onto one of the nine rows above; do the mapping as a mechanical pass, don't invent a tenth size while doing it.

---

## 5. Icons — Phosphor, not Lucide

Switch `Icon.tsx`'s underlying import from `lucide-react` to `@phosphor-icons/react`. This is a real, considered swap, not a cosmetic one: Phosphor ships every icon in six weights (thin/light/regular/bold/fill/duotone) from one import, which finally gives this app a way to express the "distinct yet consistent" requirement from the brief *inside the icon system itself*, not just in card color:

| Weight | Use |
|---|---|
| **Light** | Default everywhere — nav, buttons, list rows. This is the weight that actually reads as calm; Lucide's fixed 2px stroke is comparatively heavier and more clinical than the warm/soft register this app wants. |
| **Regular** | Small contexts (16px and below) where Light gets too thin to stay crisp |
| **Fill** | Active/selected state only — a nav item's icon fills solid when its space is active, giving a state change with zero added color or glow |
| **Duotone** | Reserved for empty states and onboarding only — a two-tone icon at larger size (32px+) gives those specific moments a bit more visual weight without licensing duotone for everyday UI, where it would be too loud |

Sizing tokens stay 16/20/24px as before. No mixed sets — every current `lucide-react` import outside the wrapper (the 38 files already flagged as bypassing `Icon.tsx`) gets fixed in the same pass as the library swap, not left for later.

---

## 6. Motion — a named vocabulary instead of ad hoc values

Framer Motion stays the engine (`AGENTS.md` hard invariant #5 — `LazyMotion`, `m.*` only, unchanged). What's missing is a small, named set of motion tokens so "add a transition" stops meaning "invent new numbers":

| Token | Duration | Easing | Use |
|---|---|---|---|
| `--motion-micro` | 120ms | `ease-out` | Hover/press feedback — button press, checkbox toggle |
| `--motion-enter` | 200ms | `cubic-bezier(0.16, 1, 0.3, 1)` | A panel, sheet, or menu appearing |
| `--motion-exit` | 150ms | `ease-in` | The same leaving — always faster than its own entrance, so dismissal never feels sluggish |
| `--motion-page` | 280ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Route/page transitions |
| `--motion-spring` | — | `{ type: "spring", stiffness: 400, damping: 30 }` | The *only* place spring physics is allowed: drag-to-dismiss release on `Sheet`, and reordering feedback. Not buttons, not cards, not page transitions — reserving spring to a couple of intentional moments is what makes it read as intentional instead of default-bouncy. |

**Explicitly banned:** the generic scroll-triggered fade-up-with-stagger pattern (`initial={{opacity:0,y:20}}`, `whileInView`, a fixed stagger delay applied uniformly down a list) — this is the single most literally-named "AI wrote this" motion tell in current design criticism, specifically because it signals "polished" without doing anything functional for the person using the app. If a list needs to feel alive on load, give it one deliberate, brief `--motion-enter` on the container, not a cascading animation on every child.

Every token above needs a `prefers-reduced-motion` fallback that removes the *transform/opacity animation*, not the *state change itself* — a menu still needs to open, it just needs to open instantly instead of sliding, exactly as `DS-14`'s existing hover-transform-removal precedent already does it correctly.

---

## 7. Sidebar — rebuilt as a nav rail, not a sidebar

The current implementation (`Navigation.tsx`, 741 lines) is the single largest, least-focused file in the layout layer, and it shows. Rebuild it around one clear structural idea instead of accreting more special cases:

- **A narrow (72px) icon-first rail, not a wide labeled sidebar**, closer to Linear, Arc, or Raycast than a traditional admin-dashboard sidebar with left-aligned icon+label rows stacked in a wide column. Each space (Do/Think/Remember/Explore) gets one icon, Phosphor Light weight, 24px, in its own space color only when active (Fill weight + the space color; Light weight + `--text-3` when inactive — no glow, no background pill with a blurred edge, just fill-weight + color doing the whole job).
- **Labels appear as a tooltip on hover/focus, not as permanent text**, except on first load for a few seconds (a brief, one-time `--motion-enter` label reveal, then collapse) — this is what actually produces "alive" without resorting to ambient background animation, because it's a real, functional micro-interaction tied to something the user is doing (exploring the rail for the first time).
- **Collapsed is not a separate secondary state to design twice** — the rail *is* collapsed by default on screens under 1024px, and manually collapsible above that; there is one rail component with an `isExpanded` boolean, not two components that can drift apart.
- **Active-space indicator is a 2px left-edge bar in the space color plus the icon Fill-weight swap** — two signals, both load-bearing (edge bar for at-a-glance scanning, icon fill for close-up confirmation), stopping well short of the three-plus-signal pileup called out in §1.

---

## 8. Dropdowns and menus — one recipe, everywhere

Every place in the app that currently opens a floating list of options — the `Dropdown` component, the `Popover` component, `CaptureModal`'s space picker, `MonthView`'s day-cell context actions — gets rebuilt on exactly two Base UI primitives:

- **`@base-ui/react/select`** for choosing one value from a list (space picker, priority picker, sort order) — this replaces `Dropdown.tsx`'s `variant="select"` and `variant="chip"` paths.
- **`@base-ui/react/menu`** for triggering an action or showing a contextual list of actions (row overflow menu, calendar day-cell actions, the account menu) — this replaces `Dropdown.tsx`'s `variant="combobox"` path where it's actually being used for actions rather than value selection, and both of the hand-rolled feature-file implementations outright.

Every instance shares one visual recipe regardless of which primitive backs it: `--elev-floating` (§3), `--radius-md`, an 4–8px content inset, Phosphor Light-weight icons at 16px for any item that has one, and `--motion-enter`/`--motion-exit` (§6) for open/close — not each menu inventing its own timing and padding as `Dropdown.tsx` and `Popover.tsx` currently each do independently. Keyboard behavior (arrow-key roving focus, typeahead, Escape returns focus to trigger, Enter/Space activates) comes free from Base UI and should never be re-implemented by hand again anywhere in this app.

---

## 9. Onboarding and sign-in — direction

The brief for this pass is "more creative," which without more specificity just produces more slop, so here's the concrete shape:

- **Onboarding is not a form wizard with a progress bar.** It's three or four short, full-bleed screens, each built around one Fraunces display headline (§4) and the ambient orb background already in `OnboardingBackground.tsx` — that background asset is genuinely good and under-used; let it carry more of the emotional weight instead of adding a separate illustration style on top of it (§1's existing anti-pattern, restated because this is exactly where teams cave and add a stock illustration under time pressure).
- **No progress dots, no "step 2 of 4."** A calm app doesn't remind you you're behind schedule during the one moment it's trying to make a first impression. Forward/back are the only navigation; there is no numeric framing of how much is left.
- **Sign-in is a single screen, no split-screen marketing-copy-on-the-left pattern** (another named 2026 template tell) — one centered card, the same ambient background, Fraunces for "Welcome back" only, everything else Plus Jakarta Sans.
- **Empty first-use states across the four spaces are not identical "no items yet" copy with a centered icon.** Each space's empty state uses that space's Duotone icon (§5) at 32px+ and one line of copy written for that specific space's actual first action, not a templated string with the space name substituted in.

---

## 10. App icon and logo — replace, don't tune

`public/icon.svg` is the exact pattern named directly, across multiple current sources, as the default AI-icon-generator output: a gradient-filled rounded square with a soft blended blob inside it. It needs a genuinely different mark, not a color adjustment.

**Direction:** a single flat shape, no gradient, no blend mode, no grain filter as a substitute for actual character. Given the app's ambient-orb visual language already carries the "soft warm light" idea everywhere else, the icon should be the one place that idea gets compressed into something graphic and specific rather than atmospheric — a simple, slightly asymmetric mark (think: a single soft-edged crescent or an off-center dot-and-arc, evocative of a rising sun without literally drawing a sun) rendered as one confident flat shape in `--accent` (`#E5B41E`) on `--bg-base` (`#0F0A00`).

**Concrete constraints, unchanged from the earlier spec and still correct:** must read as one shape with zero surviving detail at 16px (browser tab test); the 1024px master must not be a "more detailed" version of the same mark; no gradient fill, no drop shadow, no blur — the icon is the one surface where the glass/blur language explicitly does not apply, both for the AI-slop reason above and because a translucent icon over a user's home-screen wallpaper is illegible regardless. Execute this through an actual icon designer or a deliberate manual pass — this section specifies direction and constraints, not a finished asset.

---

## 11. Mobile

The current gap here is systemic, not a list of one-off bugs, so the fix is a rule, not a checklist:

- **The nav rail (§7) is the mobile nav.** There is no second, different mobile navigation pattern (a bottom tab bar bolted on separately) — the same rail collapses to an icon-only bottom-anchored bar under 768px, same component, same tokens, same active-state treatment, so "distinct yet consistent" holds on mobile the same way it does on desktop instead of becoming two systems that drift.
- **Every touch target is 44×44px, no exceptions**, including inside dense list rows and calendar cells — this was already a token (`--touch-target`) that wasn't consistently applied; mobile is where that gap is most visible and least excusable.
- **Sheets, not modals, on mobile** — anything that opens as a centered dialog on desktop opens as a bottom sheet on mobile (`Sheet.tsx` already supports this), never a shrunk-down centered modal that forces pinch-zoom or awkward thumb reach.
- **Motion tokens (§6) apply identically on mobile** — no separate "mobile has no animation because it's a checkbox someone forgot" state; `prefers-reduced-motion` is the only thing allowed to turn animation off, not viewport width.

---

## 12. Accessibility — unchanged, still a hard gate

The numeric commitments from the prior version of this file stand as written and aren't repeated here to keep this document from ballooning back into something DESIGN_SYSTEM.md should own: WCAG 2.2 AA, 4.5:1 text contrast / 3:1 UI-component contrast, 44×44px touch targets, a visible focus indicator on every interactive element in every theme×mode combination, non-drag alternatives for every drag gesture, and a reduced-motion fallback for every motion token in §6. Two additions specific to this rewrite: **Phosphor icons at Light weight must still clear 3:1 contrast against their background** (thin strokes are more contrast-sensitive than Lucide's heavier default — check this explicitly during the icon migration, don't assume weight swaps are contrast-neutral), and **the new Base UI `Menu`/`Select` migration (§8) must be verified against Base UI 1.x's own documented fixes for submenu delay and Escape-returns-focus-to-trigger** rather than assumed to inherit `Dropdown.tsx`'s current (unverified) keyboard behavior.

---

## 13. Change log and ownership

| Date | Change | By |
|---|---|---|
| 2026-08-17 | Initial version (deferred-index approach) | Design review pass |
| 2026-08-19 | Full rewrite — moved from an index-only companion file to a concrete target-state spec, in direct response to a full-product visual-quality complaint. Diagnosed and named the specific code locations behind each complaint (§0); replaced the glow-based elevation system (§3); replaced Inter with Plus Jakarta Sans + Fraunces (§4); replaced Lucide with Phosphor (§5); introduced a named motion token vocabulary and banned the generic scroll-fade pattern (§6); specified a sidebar rebuild (§7); specified consolidating four separate dropdown/menu implementations onto Base UI's `Menu`/`Select` (§8); specified onboarding/sign-in direction (§9); specified an app icon replacement direction (§10); specified a unified mobile-nav rule (§11). | Design review pass, in response to direct product feedback |

This file changes again the next time the *identity* changes — not for routine ticket work, which still belongs in `DESIGN_SYSTEM.md`/`COMPONENT_MANIFEST.md`/`EXECUTION_SPEC.md`. Given this is now a from-scratch visual direction rather than documentation of the shipped product, the next real milestone for this file is updating it *back* to describe what's actually built once the phases above land — an aspirational spec that's never reconciled against reality is exactly the kind of drift §0 of the previous version warned about, applied to itself.
