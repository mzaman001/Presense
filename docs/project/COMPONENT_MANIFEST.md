# Component Manifest — Presense

This is the dictionary referenced by `AGENTS.md` §0.3. It is the list of approved UI primitives. **If a pattern you need is not on this list, stop and ask before building something new.** Do not build a one-off card, dropdown, or input for a single feature — every primitive here is meant to be reused everywhere that kind of element appears.

This file lists what exists today (`src/components/ui/`) with its status. Entries marked `NEEDS SPEC` exist in code but do not yet have a documented set of variants/props/usage — filling that in is tracked as part of `DS-14` in `docs/plans/EXECUTION_SPEC.md`. Do not treat `NEEDS SPEC` as license to invent a competing version; use the existing component and flag the missing spec.

| Component | File | Status | Variants / notes |
|---|---|---|---|
| Button | `button.tsx` | NEEDS SPEC | Consolidation target of `DS-04`. Do not add a new button-like element with custom padding/radius/color — extend this component's variants instead. |
| GlassCard | `GlassCard.tsx` | NEEDS SPEC | The one surface/card primitive. Consolidation target of `DS-04` (retires `.glass-card`/`.glass-panel` CSS classes). |
| Dropdown | `Dropdown.tsx` | STABLE — DO NOT MODIFY WITHOUT REGRESSION TEST | Portal-based (`createPortal`). See `AGENTS.md` invariant 3. Any change here must include a screenshot/recording of the menu open inside a scrolled/`overflow`-constrained container. |
| Popover | `Popover.tsx` | STABLE — DO NOT MODIFY WITHOUT REGRESSION TEST | Same portal requirement as `Dropdown`. |
| Sheet | `Sheet.tsx` | STABLE | Drag-to-dismiss, `useVisualViewport` keyboard offset. Do not replace without evaluating `Vaul` first (`TOOL-10`) — do not hand-roll a second sheet/drawer implementation. |
| Input | `Input.tsx` | NEEDS SPEC | Use for every text field. Do not style a raw `<input>` in a feature component. |
| Textarea | `Textarea.tsx` | NEEDS SPEC | Use for every multi-line field. |
| SearchInput | `SearchInput.tsx` | NEEDS SPEC | Use for every search box. |
| PageHeader | `PageHeader.tsx` | ADOPTED | Used by Do, Inbox, Think, Explore, Remember, Home. Every space's page header goes through this component. |
| EmptyState | `EmptyState.tsx` | ADOPTED | Every empty-list condition in the app goes through this component. Its action button must open the same panel as that space's header "Add" action (see `BUG-24`) — Inbox is the one documented exception, where routing to Quick Capture is correct. |
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
| AppErrorFallback / ModalErrorBoundary | `AppErrorFallback.tsx`, `ModalErrorBoundary.tsx` | STABLE | The one error-boundary pattern at app level and modal level respectively. |
| UpdatePrompt | `UpdatePrompt.tsx` | NEEDS SPEC | |

## Colors, spacing, typography

Do not use a hex value, an inline `style` color, or a Tailwind default-palette class (`bg-blue-500`, `text-red-400`, etc.) anywhere in a feature component. Use the CSS custom properties defined in `src/app/globals.css` (`--space-do`, `--space-think`, `--space-remember`, `--space-explore`, `--accent`, `--color-text-*`, `--color-surface*`) or the locked Tailwind theme's token-backed utility classes. If the token you need doesn't exist, stop and ask — do not invent a new hex value inline. The full token reference is in `docs/project/DESIGN_SYSTEM.md`.

## Adding a new primitive

If you've confirmed (by checking this file and asking, per `AGENTS.md` §0.3) that no existing primitive fits: build it in `src/components/ui/`, add it to this table in the same PR with a `NEEDS SPEC`→filled status, and update `docs/project/DESIGN_SYSTEM.md` if it introduces a new token. A new primitive without a corresponding update to this file is an incomplete PR.
