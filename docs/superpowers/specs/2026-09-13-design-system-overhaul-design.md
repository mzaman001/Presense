# Presense Design System Overhaul — Design Spec

Status: draft, awaiting review
Track: 1 of 2 (design/UX). Performance & memory is a separate follow-up spec, out of scope here.

## 1. Problem & goals

Presense is functional but doesn't look or feel considered: the sidebar is visually inconsistent, behaviorally unreliable, and broken on mobile; dropdowns have positioning glitches and dated visual treatment; the six areas of the app (Home, Inbox, Do, Remember, Think, Explore) don't share a coherent visual or interaction language; onboarding and sign-in don't set a tone; and the whole thing reads as generic rather than considered.

Goal: a single, coherent design system — tokens, components, patterns — applied consistently across every page, that feels calm and personal (not decorated, not generic), works as a mobile-first PWA, and meets WCAG AA.

Non-goals for this spec: performance/memory optimization (separate track, starts after this one), and re-litigating backend/data architecture (Supabase/RLS/TanStack Query patterns in `AGENTS.md` §1 stay as-is).

## 2. Product framing

Presense is a **personal task and memory manager** — single-user, no collaboration features. Six areas today, kept in this redesign (IA is open to restructuring within this set, not expansion beyond it):

| Area | Purpose |
|---|---|
| **Home** | Calm daily overview — what matters today, across all spaces. Not a dense dashboard. |
| **Inbox** | Unsorted quick-capture. Fast add, triage later into a space. |
| **Do** | Tasks. |
| **Remember** | Reminders / recall — includes `people` and `locations` sub-views. |
| **Think** | Journaling / short notes. |
| **Explore** | Saved links, books, movies — external references. |

Plus **Settings** (modal, not a route today) and **Trash**.

Do, Remember, Think, and Explore share one page template (header + content shell + shared interaction patterns) with room for per-space identity within it — not fully custom layouts, not fully identical either. Home and Inbox are structurally distinct because their jobs are different (overview vs. capture).

## 3. Design philosophy

**Calm, personal, sunrise/sunset-toned — like a meditation app, executed with the precision of a tool like Linear, not the softness of a wellness brand.** Concretely:

- **Flat, precise surfaces — no gradients, glow, glassmorphism, or neumorphism.** Depth comes from hairline borders and opacity-stacked surfaces (translucent white-on-dark, subtle tint-on-light), the way Linear's actual production UI works — not from decoration. This is what keeps it from reading as generic/AI-generated.
- **One theme, light + dark, not three.** The existing `warm`/`navy`/`forest` theme selector is retired. One cohesive palette (warm-neutral base) that adapts between light and dark.
- **One accent color: terracotta / burnt orange.** Used sparingly — active nav state, unfinished-task ring, primary action border/underline. Never used decoratively.
- **Airy, spacious density.** Generous spacing, larger touch targets, fewer items per screen — mobile-first, since mobile is the primary usage context.
- **Motion is restrained but not absent.** Short (150–250ms), GPU-cheap (transform/opacity only) animation on state changes (task complete, modal open/close, page transition), *plus* subtle ambient motion in specific places (e.g., a slow background tone shift echoing sunrise/sunset) — never idle motion that competes for attention. Everything respects `prefers-reduced-motion`. `MotionProvider`'s existing `LazyMotion domMax strict` setup stays.
- **Typography carries the "personal, premium, calm" feeling**, not iconography or illustration. See §5.

## 4. Component foundation

Adopt **shadcn/ui conventions** (Radix-based, copy-in components, not a black-box dependency) as the styling/composition pattern going forward, replacing `@base-ui/react` incrementally as components are rebuilt space-by-space — not a big-bang migration. `Dropdown.tsx` and `Popover.tsx` already render through `FloatingPortal` with `floating-ui` (`flip`/`shift`/`offset`) — the *positioning engine* is sound; what needs to change is visual treatment and, per AGENTS.md invariant 3, the portal-rendering discipline must be preserved in whatever replaces them. The reported positioning glitches need a targeted repro pass before assuming a rewrite fixes them — this is investigation work for the implementation phase, not something to design around blindly.

Icons stay **Lucide** (already a dependency, used consistently in `Navigation.tsx` today) — refine stroke-width/sizing consistency, not the icon set itself.

## 5. Typography

Two-typeface system:

- **UI / body: Inter.** Already the de facto standard for this kind of interface (also what Linear uses), extremely legible at small sizes, pairs cleanly with Lucide's stroke weight.
- **Headline / display: TBD from a shortlist, chosen with a real side-by-side preview during implementation rather than more rounds of description.** Requirement, from your feedback: not Fraunces' soft/organic character, not a classic editorial serif (Playfair-adjacent), not a plain/basic serif — something that reads as **premium, calm, meditative, and highly readable**. Shortlist to preview: a refined low-contrast serif with restrained personality (e.g. Newsreader, Source Serif 4, Piazzolla) alongside 1–2 non-obvious options. This is the one open decision explicitly deferred out of brainstorming into implementation, where it can be shown in context rather than argued about in the abstract.

## 6. Color system

Flat, opacity-stacked, single-accent — grounded in Linear's actual token structure, re-themed warm:

- **Light mode:** warm off-white/greige background (not pure white), near-black warm-toned text, hairline warm-grey borders.
- **Dark mode:** near-black warm-toned background (not pure black), warm off-white text, borders as low-opacity white overlays (`rgba(255,255,255,0.05–0.1)`), surfaces as low-opacity white fills over the base — same "luminance stacking" approach Linear uses for elevation, not drop shadows.
- **Accent:** terracotta/burnt-orange, one value per mode, used only for: active nav indicator, unfinished-task/reminder ring, primary CTA outline, focus-adjacent emphasis (never replacing the dedicated focus ring).
- All values become CSS custom properties in `src/app/globals.css` (already the token home per AGENTS.md §3) — no one-off hex values anywhere else.

## 7. Navigation

- **Desktop:** keep the existing hover/focus-expand collapsible rail pattern (`Sidebar()` in `Navigation.tsx`) as the interaction model — it's structurally sound (portal-free, CSS-width-transition, already token-driven) — but redesign its visual treatment and fix the reported IA and interaction issues (ritual/plan-day row complexity, "Remember" linking to `/remember/people` specifically, badge treatment) as part of the rebuild.
- **Mobile:** a real bottom tab bar (`BottomNav()` already exists and is close to right — thumb-reachable, native-feeling), not a drawer. Redesign its visual treatment and audit/fix the reported mobile breakage.
- **Global quick-add:** a command palette (desktop, `Cmd+K` — `Kbd` hint already surfaced in the sidebar today) and a floating action button (mobile, already present as the center bottom-nav action). Adding an item lets you **pick a destination space at capture time** (Do / Remember / Think / Explore / Inbox), defaulting sensibly rather than forcing Inbox always.
- IA is open to restructuring within the six-area set if the redesign surfaces a better structure (e.g., how Trash, Settings, and Remember's `people`/`locations` sub-views are exposed) — proposed during implementation, not pre-decided here.

## 8. Modals & dialogs

**Centered dialogs** as the default pattern for edit/confirmation/settings/add flows, on both mobile and desktop — not bottom sheets, not side panels. Existing `ConfirmModal.tsx`, `Sheet.tsx`, `DynamicModals.tsx` get consolidated onto one dialog primitive (shadcn/Radix Dialog) rather than maintaining parallel modal components. `DynamicModals.tsx`'s conditional-render discipline (AGENTS.md §1, "Client boundaries") is preserved — modals still only mount when open.

## 9. Empty states

Warm and encouraging, with a small tasteful illustration (not stock, not cheerful-startup copy) — fits the calm/personal tone and makes an empty Do/Think/Explore list feel intentional rather than broken. `EmptyState.tsx` gets extended to support this, replacing today's presumably text-only treatment.

## 10. Accessibility

WCAG AA, verified with **automated (`@axe-core/playwright`, already wired) plus manual keyboard/screen-reader spot checks** on key flows (sign-in, quick-add, completing a task, opening/closing every modal type). Every interactive element keeps a real focus state distinct from the terracotta accent-as-decoration use. Touch targets stay ≥44px for primary actions, ≥36px otherwise (AGENTS.md §3 — unchanged).

## 11. Responsive strategy

**Mobile-first**, since that's the primary usage context. Bottom-tab nav + airy spacing + large touch targets are designed for mobile first, then adapted up to desktop (sidebar, more content density where screen space allows) — not the reverse.

## 12. Brand mark

A simple logomark (not elaborate) designed as part of this system, replacing the current inline SVG circle-with-gradient in `Navigation.tsx`. Used on: login screen, PWA icon/favicon, sidebar brand tile. Designed once tokens/typography are locked, so it's coherent with the rest of the system rather than done in isolation.

## 13. Onboarding & sign-in

- **Sign-in:** minimal and fast — this is also a performance fix (`/login` currently ships ~1.1MB JS for one email field; the redesign should not repeat that mistake regardless of the separate performance track).
- **Onboarding:** treated as a deliberate first impression — a short, calm, well-crafted sequence (not a long wizard) that sets the tone for the app, replacing `OnboardingWizard.tsx`.

## 14. Cleanup process

Before deleting anything: **investigate and propose a list** (unused components, duplicated logic — e.g. `Dropdown.tsx` vs `Popover.tsx` vs any overlap in `Sheet.tsx`/`ConfirmModal.tsx`, dead routes) with reasoning, for approval, per AGENTS.md §2.5 ("prove it's unreferenced first"). No deletions happen silently as a side effect of the redesign.

## 15. Feature scope

This pass is **not** restricted to visual-only changes — cutting or simplifying a feature that doesn't earn its place is in scope (e.g., the ritual/plan-day system's current complexity in the sidebar is a candidate for simplification, not just re-skinning). Any such cut gets called out explicitly when it comes up, not silently dropped.

## 16. Rollout sequencing

1. **Foundation:** tokens (color/type/spacing/motion) in `globals.css`, core components (button, input, dialog, dropdown, nav shell, empty state) on the shadcn/Radix pattern.
2. **Home, sign-in, onboarding** — first full pages, validate the system end-to-end on the highest-traffic surfaces.
3. **Do, Remember, Think, Explore** — one at a time, each independently shippable, using the shared space template from §2.
4. **Settings, Trash, Inbox polish** last.

No hard deadline — sequencing optimizes for reviewability, not speed.

## 17. Testing

- `@axe-core/playwright` accessibility checks extended to cover every redesigned page/modal.
- Manual keyboard-only and screen-reader pass on: sign-in, onboarding, quick-add (all destinations), completing/deleting a task, every dialog type, mobile bottom-nav, desktop sidebar collapse/expand.
- Existing gates unchanged and must stay green throughout: `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` (AGENTS.md §0).

## 18. Explicitly deferred to implementation (not re-opened here)

- Exact headline typeface (§5) — decided with a real preview.
- Specific IA changes beyond the six-area set (§7) — proposed when the actual page is being rebuilt.
- Specific list of components/files to delete (§14) — proposed for approval before any deletion.
- Settings page content/layout, search-within-a-space behavior, offline/PWA caching UX — not covered in this round of questions; handled as normal design decisions during implementation, escalated back to you only if genuinely ambiguous.
