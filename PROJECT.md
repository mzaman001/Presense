# Project: Presense Phase 4 (Sunsama Rituals & UI Polish)

## Architecture
- **State management**: Zustand (`src/store/useAppStore.ts`) handles active states like `activeRitual` ('morning' | 'evening' | null) and setting states.
- **Database schemas**: Supabase table `user_settings` tracking ritual dates and constraints.
- **UI & Layout**: `RitualOverlay` wraps the app layout (`src/app/(app)/layout.tsx`) and handles full-screen takeover based on state.
- **Interactions**: Framer Motion for swipe mechanics; `react-textarea-autosize` for auto-sizing text inputs.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | E2E Testing Suite | Create test files in `src/lib/__tests__/phase4.test.tsx` and publish `TEST_READY.md` | None | IN_PROGRESS (Conv: 0ba421da) |
| 2 | Realtime Hook Fix | Fix debouncing in `useRealtime.ts` | None | IN_PROGRESS (Conv: 19470d71) |
| 3 | Database Migration | Apply SQL migrations for `user_settings` | None | IN_PROGRESS (Conv: 19470d71) |
| 4 | Sunsama Morning/Evening Ritual | Build `RitualOverlay.tsx`, trigger from `AppInitializer.tsx` and `Navigation.tsx` | M2, M3 | IN_PROGRESS (Conv: 19470d71) |
| 5 | Swipe Mechanics & Textarea Polish | Standardize swipe-to-delete and `react-textarea-autosize` | None | IN_PROGRESS (Conv: 19470d71) |

## Interface Contracts
### appStore ↔ RitualOverlay
- `activeRitual`: 'morning' | 'evening' | null
- `userSettings`: UserSettings object containing `last_ritual_date`, `shutdown_time`, `daily_capacity_minutes`
- `updateUserSetting(key, value)`: updates setting in state and triggers DB write

### database ↔ user_settings
- `last_ritual_date`: date
- `shutdown_time`: text (default '18:00')
- `daily_capacity_minutes`: integer (default 240)

## Code Layout
- `src/hooks/useRealtime.ts`: Realtime subscription hook
- `src/components/features/RitualOverlay.tsx`: Sunsama full-screen flow overlay
- `src/components/features/MorningPlan.tsx`: Step 1 of Morning Ritual (Triage)
- `src/components/features/MorningCommit.tsx`: Step 2 of Morning Ritual (Commit & Estimates)
- `src/components/features/EveningReview.tsx`: Evening Review step
- `src/components/layout/AppInitializer.tsx`: Automatically triggers rituals based on time and date
- `src/components/layout/Navigation.tsx`: Sidebar manual planning trigger
