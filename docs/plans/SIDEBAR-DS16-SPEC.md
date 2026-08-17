# DS-16 — Sidebar rail redesign to best-in-class quality

**Date:** Aug 17, 2026 · **Type:** Design-system ticket · **Scope:** `src/components/layout/Navigation.tsx`, `src/app/globals.css` only. Mobile `BottomNav`/`MobileDrawer`/`MobileTopBar` untouched. Hover/focus-expand mechanism (invariant 4) unchanged.

## Problem

After DS-15, the rail gained tooltips, an inbox badge, and icon consistency, but its **visual language is still flat**: a strip of equal-weight outline icons where Inbox/Do/Remember/Think/Explore are indistinguishable, the active state is a barely-visible tint, Quick Capture's heavy yellow pill dominates, and the top brand mark and bottom account chip float without anchoring. Per the user: "it still looks as same as before. Ugly."

## Research basis

The redesign is grounded in four current best-in-class references:

1. **Linear's March 2026 refresh** ("A calmer interface for a product in motion") — two governing principles: *don't compete for attention you haven't earned* (the sidebar must recede: dimmer, smaller icons, muted inactive text, more vertical padding) and *structure should be felt, not seen* (grouping via spacing rather than proliferating hairline dividers) [1].
2. **Linear's design system** — dark surfaces stepped one level above canvas, hairline 0.5px borders, type weights capped at 500–510 (never heavy bold), a single accent used as a "functional flashlight" reserved for the primary action and active indicators only [2].
3. **Notion's sidebar** — strategic content blocks on an 8px grid, icons inside aligned consistent squares, full-width clickable rows with 8px radius, and a workspace header that anchors the top while a user chip anchors the bottom [3].
4. **M3 Expressive / Todoist 2026** — calmer, better spacing and typography with subtle color [4]; **Things 3** — quiet warm surfaces, grouped sections with visual weight concentrated in "Today"; **Arc** — active item carries the rail's visual energy via a highlighted pill [5].

## Design decisions

| # | Decision | Source pattern |
|---|----------|----------------|
| 1 | **Three-tone state hierarchy.** Inactive rows are muted (text-3, icon at 55%); hover raises to a soft surface fill with brightened label; active gets a filled accent-dim pill, accent icon at full opacity, and a left-edge accent bar. Exactly one row "wins". | Linear + M3 |
| 2 | **Grouping via spacing, not lines.** Remove the thin dividers between tool rows; use a 12–16px spacing rhythm between the four blocks (actions / spaces / tools / account). Small uppercase, letter-spaced block labels appear only in the expanded state. | Linear "structure felt not seen" |
| 3 | **Anchored brand + account tiles.** The collapsed brand mark becomes a rounded square container (like the account avatar) so top and bottom mirror each other; the expanded brand row carries the wordmark in medium weight at accent. | Notion |
| 4 | **Consistent 32px icon tiles.** Every icon sits in a uniform tile with 1.5 stroke; active tile has the accent tint — no more bare floating icons. | Notion icon squares |
| 5 | **Quick Capture demoted from "shouts".** Keep it solid accent (it is the primary action — Linear's flashlight rule says the accent is *allowed* there), but reduce its glow/height slightly so the active nav row and the CTA share the rail's energy instead of the CTA monopolizing it. | Linear accent discipline |
| 6 | **Ritual row integrated.** No longer a weirdly distinct outline pill; treated as a nav row with an accent icon when pending and check-mark state preserved. | Things groups |
| 7 | **Inbox badge kept** (DS-15), restyled to sit cleanly inside the 32px tile. | M3 badge spec |
| 8 | **Mobile untouched.** BottomNav already has a center FAB and label states; only the active-label color emphasis is tuned if visible in review. | — |

## Acceptance criteria

1. Collapsed rail shows a clear hierarchy: anchor tiles at top and bottom, a single quiet CTA tile, and nav/tool rows that are visibly muted until hovered or active.
2. Active row is unmistakable (pill + accent icon + left accent bar); hover state is distinct from both inactive and active.
3. No thin-line dividers between tool rows; groups separated by spacing rhythm; block labels visible only when expanded.
4. Invariant 4 preserved: same `w-[80px] focus-within:w-[248px] hover:w-[248px]` mechanism, no click-toggle, no persistence, no new structural components.
5. Build (`VERCEL=1 npm run build`) and tests (`npm test`, 181 baseline) pass; no new eslint errors beyond pre-existing baseline.

## References

[1]: https://linear.app/now/behind-the-latest-design-refresh "Linear — A calmer interface for a product in motion (Mar 2026)"
[2]: https://styles.refero.design/style/90ce5883-bb24-4466-93f7-801cd617b0d1 "Refero — Linear design system style reference"
[3]: https://medium.com/@quickmasum/ui-breakdown-of-notions-sidebar-2121364ec78d "Medium — UI Breakdown of Notion's Sidebar"
[4]: https://www.todoist.com/help/articles/2026-changelog-HD3jJAtLd "Todoist — 2026 Changelog (Material 3 Expressive)"
[5]: https://culturedcode.com/things/features/ "Cultured Code — What's New in Things"
