# Original User Request

## Initial Request — 2026-06-21T22:01:26+05:30

# Teamwork Project Prompt — Draft

> Status: Launched

Implement Phase 3 (UI Polish & Settings Cleanup) from the `presense_ux_research_report.md` artifact to fix the UI design, clean up the settings toggles, and streamline the Explore taxonomy.

Working directory: .
Integrity mode: demo

## Requirements

### R1. Explore Taxonomy Overhaul
Remove confusing custom "Types" and overlapping "Tags" from `ExploreDrawer.tsx`. Lock down a fixed list of system Types (e.g. Link, Note, Book) with standardized `lucide-react` icons to ensure visual continuity. Ensure all tags and categories are fully searchable in the `SearchModal`.

### R2. Settings Declutter & Layout Fixes
In `SettingsModal.tsx`, remove unnecessary and confusing toggles (e.g., "Routing Confidence", "NLP for dates", "people briefing reminder"). Re-layout the Focus tab so that "Auto start break" is grouped logically with the timer durations rather than sitting awkwardly in the middle. Ensure that clicking the profile button in the bottom left of the Sidebar reliably opens the Settings modal to the Profile tab.

### R3. Task Card UI Polish & Think Space Lag
Fix the visual bugs in `TaskCard.tsx`: clean up the border clipping and fix the overlapping person icons so they don't look ugly or messed up, referencing premium standards like Things 3. Investigate and fix the jarring page transition/lag when opening a single thread in the Think space (`src/app/(app)/think/[id]/page.tsx`). 

## Acceptance Criteria

### Verification (Agent-as-Judge Auditing)
- [ ] The `ExploreDrawer` no longer allows creating custom types; it only uses a fixed list of system types with visually consistent `lucide-react` icons.
- [ ] "Routing Confidence" and "NLP for dates" have been completely removed from the `SettingsModal`.
- [ ] The "Auto start break" toggle in settings is grouped directly with timer durations, not between unrelated break settings.
- [ ] Clicking the profile button in the sidebar opens the settings directly to the Profile tab.
- [ ] `TaskCard` icons no longer overlap aggressively or break out of their container borders.
- [ ] Opening a single thread in the Think space feels smooth, utilizing a prefetch or optimized layout transition instead of a full jarring remount.

---
*Next: when approved → delegate via invoke_subagent (see Delegation Protocol)*
