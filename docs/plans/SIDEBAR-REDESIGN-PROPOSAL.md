# Sidebar Redesign — Research, Findings, and Proposal

**Date:** August 17, 2026 · **Prepared for:** Presense backlog decision · **Working file:** `docs/plans/SIDEBAR-REDESIGN-NOTES.md` (delete after ticket is recorded)

## 1. What the current sidebar does, and what the screenshots reveal

The current desktop sidebar (`src/components/layout/Navigation.tsx`) is a pure hover-expand rail: 80px wide when idle, expanding to 248px on hover or keyboard focus (`group/sidebar`, `w-[80px] hover:w-[248px] focus-within:w-[248px]`, `transition-[width] duration-200`). Labels slide in with a `transition-[opacity,max-width,margin]` at the same 200ms pace. Mobile uses a separate `BottomNav` with a floating capture button and is untouched by this proposal.

Comparing the two screenshots you provided against the code, four concrete observations stand out. First, in the collapsed state the rail is pure iconography with no visible affordance that expansion exists — the `title` attributes provide browser tooltips only, which are slow to appear, unstyled, and invisible on touch devices. Second, the ritual "Plan my day" button — which occupies a full row in the code between Quick Capture and Home — does not appear in either screenshot's expanded or collapsed state, suggesting it is either visually hidden when collapsed or missing from the deployed build entirely. Third, in the expanded state the utility group (Focus, Trash, Settings) floats at the bottom separated from the nav group by only a faint, 50%-opacity divider, so the relationship between the groups is unclear at a glance. Fourth, the active state works (accent fill plus a left indicator bar on Home), but there are no count badges — the Inbox row, the most count-sensitive destination in the app, shows nothing when items are waiting.

## 2. What current best practice actually says

The most authoritative primary source is **Material Design 3's Navigation Rail specification** [1], which defines the two-state collapsed/expanded rail as the standard for mid-sized and large viewports and prescribes 3–7 destinations in the collapsed state, exactly one active indicator at a time, an active indicator that "hugs" the icon and label, small badges positioned at the icon's top-right corner in collapsed mode (and beside the label when expanded), tooltips on collapsed rail items, and a divider between the rail and content — all of which match or exceed what Presense already has. M3's expansion mechanism is a **click on the menu icon**, not hover:

> The expanded navigation rail can be standard or modal, and should always open from a menu icon. [1]

The broader UX literature is consistent on the remaining dimensions. Sidebars should be 48–72px collapsed and 220–300px expanded [2] [3], group primary navigation visually above utility items (Settings, Trash, Help) with dividers and quieter styling [3], pair icons with labels except in the collapsed state where tooltips must carry the labels [3], and transitions should land between 200–300ms [3] [4]. Todoist and Notion both ship persisted, click-driven collapse/expand state [5] [6], which is the pattern most users now expect; Linear relies on an always-visible persistent rail with a hover-revealed chevron.

That creates the single important tension in this redesign: **Presense's hard invariant 4 (AGENTS.md §1, EXECUTION_RULES.md Law 6) explicitly forbids reintroducing a click-toggle sidebar.** The history matters — the app previously had a click-toggle (`sidebarState: "full" | "rail"` toggled by a chevron), and removing hover expand in favor of it was exactly the defect `BUG-01` fixed. Any proposal that reverts to click-toggle would violate an invariant and has already failed this product once. So the question is not "click vs. hover" — that decision is already made and recorded (`CONF-05` resolved: pure hover-expand, shipped) — but rather how to make the hover-expand model match the quality bar of everything above.

## 3. The gap analysis

| Dimension | Best practice | Current sidebar | Gap |
|---|---|---|---|
| Collapsed-state labels | Tooltips or hover-preview pills (M3, Linear) | Native `title` tooltips only | Medium — slow, unstyled, invisible on touch |
| Active indicator | Fills container/hugs label, single item | Accent fill + left bar | None — acceptable |
| Count badges | Small badge top-right of icon, collapsible count | No badges anywhere | High — Inbox has no count |
| Group hierarchy | Clear dividers, utility group visually subordinate | One faint 50% divider | Low–medium |
| Expansion trigger | Click menu icon (M3) vs. hover-expand (invariant) | Hover + focus-within | **Decision point (see §4)** |
| Row heights | 40–48px min touch target | h-11 (44px) | None |
| Icons | 20–24px, consistent set and weight | 20px / 17px mixed (nav vs. utility) | Low |
| Ritual button | Primary action row visible in both states | Visible in expanded, absent in collapsed screenshots | Medium — verify |
| Persistence | Persist collapsed preference (Todoist, Notion) | None (transient hover) | Optional — needs user_settings + API |

## 4. The decision: three models

**Option A — Polish the hover rail (invariant-safe).** Keep hover/focus-expand exactly as shipped. Add styled hover-preview tooltips on collapsed rows (a small dark pill, as Linear shows on hover), real-time Inbox count badge (collapsed: small dot/badge at icon top-right; expanded: numeral beside the label), restore icon-size consistency (20px everywhere), and strengthen the utility-group divider. Optionally, restore/verify the ritual "Plan my day" row in collapsed state (it may already render but be clipped). This is the lowest-risk path and the only one guaranteed compatible with invariant 4.

**Option B — Hybrid: hover expands, click collapses (chevron appears when expanded).** Expansion stays hover/focus-driven; when expanded, a small chevron appears in the header that collapses the rail back. This closes the most common hover-rail complaint — "I can't easily put it back" — without re-introducing a click-expand, because hover-expand remains the primary mechanism. Still invariant-safe on paper (hover-expand is untouched), but it adds a clickable control to the rail, which is close to the spirit of the forbidden click-toggle and warrants your explicit sign-off. No persistence.

**Option C — Click-toggle with persisted state (Todoist/Notion style).** Collapse/expand on chevron click, state persisted to `user_settings`, hover gives a subtle preview-only expansion when collapsed. This is the industry standard per M3, but it **directly violates invariant 4** and would require the PR `Invariant-change-approved-by:` annotation and an explicit, dated decision overwriting `CONF-05`. I would not recommend it as a first move precisely because the prior click-toggle implementation is documented as having silently broken the Inbox routing menu; if you want it, it should be a deliberate product call after A or B ships and stabilizes.

**Recommended: Option A**, with the ritual-row visibility verified as part of it. If the "I want to click to close" itch persists after that ships, Option B is the natural next step.

## 5. Proposed ticket write-up (for EXECUTION_SPEC.md §29 addendum)

> ### DS-15 — Sidebar polish pass (collapsed-state affordances)
> **Priority:** High (next UI ticket after BUG-44 per user request)
> **Files:** `src/components/layout/Navigation.tsx` (sidebar only; BottomNav untouched), `docs/plans/EXECUTION_SPEC.md` (status record)
> **Model decision:** Option A — hover/focus-expand preserved (invariant 4 intact); no click-toggle added.
> **Requirement:**
> 1. Collapsed rail: styled hover-preview tooltip pill on every row (nav items, ritual button, utility items, account). Implement as a group-hover-revealed absolute-positioned pill in sidebar CSS; native `title` remains as A11Y fallback.
> 2. Inbox count badge: real-time unread/inbox count from the store; small badge top-right of icon (collapsed) and numeral beside label (expanded); zero count = no badge.
> 3. Icon consistency: all sidebar icons at size 20 strokeWidth 1.5 (utility rows currently use 17).
> 4. Utility group: replace the 50%-opacity faint divider with a clearly scannable visual separation (full divider + small caps group spacing), utility rows aligned to same 44px grid as nav rows.
> 5. Verify ritual "Plan my day" row renders in collapsed state (screenshot evidence shows it missing); if hidden by design, confirm intent and leave it.
> **Acceptance criteria:**
> 1. Invariant 4 unmodified: `w-[80px] hover:w-[248px] focus-within:w-[248px]` hover-expand preserved; no chevron/click-toggle added.
> 2. Every collapsed rail row shows a styled tooltip within ~300ms of hover; keyboard focus on a row also reveals it.
> 3. Inbox badge reflects the live store count in both states.
> 4. `npm run build` passes; `npm test` passes (181 tests); `BottomNav` behavior unchanged.
> **Depends on:** none (independent of BUG-44).
> **Out of scope:** persistence (Option C territory — requires overriding CONF-05), per-user expand preference, mobile BottomNav, theme changes.

## References

[1]: https://m3.material.io/components/navigation-rail/guidelines "Material Design 3 — Navigation rail guidelines"
[2]: https://uxplanet.org/best-ux-practices-for-designing-a-sidebar-9174ee0ecaa2 "UX Planet — Best UX Practices for Designing a Sidebar"
[3]: https://www.alfdesigngroup.com/post/improve-your-sidebar-design-for-web-apps "Alf Design Group — Sidebar Navigation Design: The Complete UX Guide (2026)"
[4]: https://uiuxdesigning.com/side-navigation-bar/ "UI/UX Designing — Side Navigation Bar: A Complete UX Design Guide"
[5]: https://www.todoist.com/help/articles/customize-the-sidebar-in-todoist-S9JLTYqZV "Todoist — Customize the sidebar"
[6]: https://www.notion.com/help/navigate-with-the-sidebar "Notion — Navigate with the sidebar"
