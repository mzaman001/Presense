# Component Manifest — Presense

This is the dictionary referenced by `AGENTS.md` §0.3. It is the list of approved UI primitives. **If a pattern you need is not on this list, stop and ask before building something new.** Do not build a one-off card, dropdown, or input for a single feature — every primitive here is meant to be reused everywhere that kind of element appears.

This file lists what exists today (`src/components/ui/`) with its status. Entries marked `NEEDS SPEC` exist in code but do not yet have a documented set of variants/props/usage — filling that in is tracked as part of `DS-17` in `docs/plans/EXECUTION_SPEC.md`. Do not treat `NEEDS SPEC` as license to invent a competing version; use the existing component and flag the missing spec.

| Component | File | Status | Variants / notes |
|---|---|---|---|
| Button | `button.tsx` | PARTIAL SPEC | Uses `@base-ui/react/button` (accessible primitive) with bespoke `cva` variants. 6 variants (primary/secondary/danger/icon/preset/capture) × 5 sizes. Consolidation target of `DS-04`. Do not add a new button-like element with custom padding/radius/color — extend this component's variants instead. Per DS-12, all internal icons must use `strokeWidth={1.5}` via the `Icon` wrapper. |
| GlassCard | `GlassCard.tsx` | PARTIAL SPEC — HAS KNOWN BUG | The one surface/card primitive. Consolidation target of `DS-04` (retires `.glass-card`/`.glass-panel` CSS classes). Two variants only: `list` (flat, no blur — for rows in a scrollable list, where per-row blur would multiply past the §3.3 blur budget) and `elevated` (blur, for standalone cards, modals, the sidebar). Do not add a third variant. **Bug:** base class includes `overflow-hidden` — root cause of cut-border hover bug (DS-30). All consumers must use `translateY` lift, never `scale` (scale + overflow-hidden clips visibly). See `docs/project/DOCS_NEEDS_CODE.md`. |
| Dropdown | `Dropdown.tsx` | STABLE — DO NOT MODIFY WITHOUT REGRESSION TEST | Portal-based (Floating UI's `FloatingPortal`/`useFloating`, with `flip`/`shift` middleware). Any change here must include a screenshot/recording of the menu open inside a scrolled/`overflow`-constrained container. **Bug:** options-list panel needs `max-height`+`overflow-y-auto`+keyboard type-ahead fix (`BUG-31`) — for long option lists (e.g., Timezone field with hundreds of entries), the panel grows to full list height and has no type-ahead. That fix must not remove the portal/positioning behavior while addressing the scroll/type-ahead gap. See `docs/project/DOCS_NEEDS_CODE.md`. |
| Popover | `Popover.tsx` | STABLE — DO NOT MODIFY WITHOUT REGRESSION TEST | Same Floating UI portal requirement as `Dropdown`. |
| Sheet | `Sheet.tsx` | STABLE — HAS KNOWN BUG | Drag-to-dismiss, `useVisualViewport` keyboard offset. Do not replace without evaluating `Vaul` first (`TOOL-10`) — do not hand-roll a second sheet/drawer implementation. **Bug:** `Sheet.tsx:58` `drag="y"` on whole sheet surface with no `dragListener={false}` or dedicated handle — swallows taps on nested buttons across 7 consumers (ConfirmModal, AddPersonPanel, SearchModal, TaskAddPanel, CaptureModal, ExploreDrawer, LocationAddPanel). Fix: dedicated drag handle + `dragListener={false}`. See `docs/project/DOCS_NEEDS_CODE.md`. |
| Input | `Input.tsx` | PARTIAL SPEC — A11Y CORRECT, HAS MOBILE BUG | Use for every text field. Do not style a raw `<input>` in a feature component. Correctly wires `aria-invalid`, `aria-describedby`, generated IDs for label association, error/hint slots (textbook accessibility per audit §3.1). **Bug:** uses `.input` CSS class inheriting `--text-body: 13px` → iOS Safari auto-zooms on focus (BUG-41). Fix: 16px on mobile. See `docs/project/DOCS_NEEDS_CODE.md`. |
| Textarea | `Textarea.tsx` | NEEDS SPEC | Use for every multi-line field. |
| SearchInput | `SearchInput.tsx` | NEEDS SPEC | Use for every search box. |
| PageHeader | `PageHeader.tsx` | ADOPTED | Used by Do, Inbox, Think, Explore, Remember, Home. Every space's page header goes through this component. |
| EmptyState | `EmptyState.tsx` | ADOPTED — HAS PADDING BUG | Every empty-list condition in the app goes through this component. Its action button must open the same panel as that space's header "Add" action (see `BUG-24`) — Inbox is the one documented exception, where routing to Quick Capture is correct. **Bug:** hardcodes `p-12` padding, but other empty states use `p-8`/`p-6` (audit §3.1). Standardize padding. **Coverage gap:** Think/Explore/Locations hand-roll their own empty states instead of using this component (BUG-40). See `docs/project/DOCS_NEEDS_CODE.md`. |
| Badge | `Badge.tsx` | NEEDS SPEC | Named variants per space/status color, once `DS-01`'s palette is the documented reference. |
| Avatar | `Avatar.tsx` | STABLE | Sizes: `sm` (32px), `md` (40px), `lg` (56px). Always provide a fallback (initials or icon) — never render empty. |
| ConfirmModal | `ConfirmModal.tsx` | STABLE | The one confirm/destructive-action dialog. Do not build a bespoke `window.confirm`-style flow or an inline "are you sure" toggle. |
| Toast (`ToastProvider`) | `ToastProvider.tsx` | STABLE | The one toast/undo mechanism. Every undoable action (delete, complete) uses this, not a custom banner. |
| Tabs | `tabs.tsx` | NEEDS SPEC | |
| Tooltip | `tooltip.tsx` | NEEDS SPEC | |
| Progress | `progress.tsx` | NEEDS SPEC | |
| Skeleton | `Skeleton.tsx` | NEEDS SPEC | Use for every loading state. Do not build a spinner-only or blank-screen loading state for a new feature. |
| LoadingSpinner | `LoadingSpinner.tsx` | NEEDS SPEC | |
| ContextualTip | `ContextualTip.tsx` | NEEDS SPEC | |
| ConnectionStatus | `ConnectionStatus.tsx` | NEEDS SPEC | |
| AnimatedNumber | `AnimatedNumber.tsx` | NEEDS SPEC | |
| AppErrorFallback | `AppErrorFallback.tsx` | STABLE | The one app-level error-boundary pattern. Used in 6 `error.tsx` files: `(app)`, `do`, `explore`, `think`, `remember`, `global-error`. |
| ModalErrorBoundary | `ModalErrorBoundary.tsx` | STABLE — MISSING FROM 5 MODALS | The one modal-level error-boundary pattern. Used in 3 modals (SearchModal, CaptureModal, SettingsModal). **Missing from:** AddPersonPanel, LocationAddPanel, ExploreDrawer, TaskAddPanel, PomodoroTimer (verify if Sheet-based modals need it). See `docs/project/DOCS_NEEDS_CODE.md`. |
| UpdatePrompt | `UpdatePrompt.tsx` | NEEDS SPEC | Listens for service worker `controllerchange`, shows toast with Reload button, `duration: Infinity` (doesn't auto-dismiss). **Gap:** 0 protection for unsaved form data — if user is mid-form and SW updates, no `beforeunload` guard (BUG-42). |
| Icon | `Icon.tsx` | STABLE | Wrapper around Lucide icons. Standardizes `strokeWidth` to 1.5 default, 2.0 for `variant="solid"` (per DS-12). 38 files import from `lucide-react` — should go through this wrapper, not import directly. |
| Kbd | `Kbd.tsx` | NEEDS SPEC | Keyboard shortcut hint display. Replaces inline shortcut-hint markup. Uses JetBrains Mono font. |
| SegmentedControl | `SegmentedControl.tsx` | NEEDS SPEC | View-switcher (e.g., Do's Board/Today/Calendar). Replaces hand-rolled view-switcher markup (DS-10). |

## Known component-level bugs (audit-verified, July 9, 2026)

These bugs are tracked in `docs/project/DOCS_NEEDS_CODE.md` with fix plans. Do not regress these; ideally, fix one per session.

| Bug ID | Component | Issue | Fix |
|---|---|---|---|
| DS-30 | `GlassCard.tsx` | Base class includes `overflow-hidden` — `hover:scale-*` clips visibly inside any `overflow-hidden`/`overflow-x-auto` ancestor | All consumers must use `translateY` lift, never `scale`. Or remove `overflow-hidden` from hoverable variants. |
| BUG-31 | `Dropdown.tsx` | Options panel has no `max-height` + no `overflow-y-auto` + no `onKeyDown` type-ahead. Affects Timezone field (hundreds of entries) | Add `max-height: min(320px, 60vh)` + `overflow-y-auto` + `overscroll-contain` + type-ahead handler |
| BUG-36/39 | `Sheet.tsx` | `drag="y"` on whole surface swallows taps on nested buttons across 7 consumers | Dedicated drag handle + `dragListener={false}`. Or adopt Vaul (TOOL-10) |
| BUG-41 | `Input.tsx` | 13px font size triggers iOS Safari auto-zoom on focus | `@media (max-width: 768px) { .input { font-size: 16px !important; } }` |
| BUG-43 | `SettingsModal.tsx` | 1 native `<select>` (line ~1417) + 4 native `type="time"` inputs (lines ~1026, 1039, 1303, 1323) | Migrate to `Dropdown variant="select"` + custom time picker on Dropdown/Popover portal infrastructure |
| BUG-25/33 | `ExploreDrawer.tsx` | Type field uses native `<input>` + `<datalist>` (browser-controlled styling) | Replace with `Dropdown variant="select"` |
| BUG-32 | `ToastProvider.tsx` | `<Toaster theme="system">` binds to OS `prefers-color-scheme`, not app `data-mode` | Bind `theme` prop to app's actual current color mode from `theme.ts`/`AppInitializer` |
| BUG-30 | `SettingsModal.tsx` | Autosave loops "Saving…"/"Saved" forever due to unscoped `watch()` returning new object reference every render | Gate save effect on `formState.isDirty`/`dirtyFields`, or deep-compare `debouncedSettings` against last-saved snapshot |
| BUG-29 | `think/page.tsx` (uses primitives) | "New thread" silently fails — writes `color_accent: "var(--accent)"` literal CSS string as data column value | Stop writing CSS variable string as data value; add `toast.error` on failure |

## Colors, spacing, typography

Do not use a hex value, an inline `style` color, or a Tailwind default-palette class (`bg-blue-500`, `text-red-400`, etc.) anywhere in a feature component. Use the CSS custom properties defined in `src/app/globals.css` (`--space-do`, `--space-think`, `--space-remember`, `--space-explore`, `--accent`, `--color-text-*`, `--color-surface*`) or, once `DS-15` lands, the locked Tailwind theme's token-backed utility classes. If the token you need doesn't exist, stop and ask — do not invent a new hex value inline.

## Adding a new primitive

If you've confirmed (by checking this file and asking, per `AGENTS.md` §0.3) that no existing primitive fits: build it in `src/components/ui/`, add it to this table in the same PR with a `NEEDS SPEC`→filled status, and update `docs/project/DESIGN_SYSTEM.md` if it introduces a new token. A new primitive without a corresponding update to this file is an incomplete PR.
