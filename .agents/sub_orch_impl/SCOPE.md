# Scope: Phase 4 Implementation Track

## Architecture
- **State Management**: Zustand (`src/store/useAppStore.ts`) handles active states like `activeRitual` ('morning' | 'evening' | null) and setting states.
- **Database Schema**: Supabase table `user_settings` tracking ritual dates and constraints.
- **UI & Layout**: `RitualOverlay` wraps the app layout (`src/app/(app)/layout.tsx`) and handles full-screen takeover based on state.
- **Interactions**: Framer Motion for swipe mechanics; `react-textarea-autosize` for auto-sizing text inputs.
- **Hook Optimization**: `src/hooks/useRealtime.ts` is debounced to handle burst updates and prevent 2.5s lockouts.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Realtime Hook Fix | Fix `src/hooks/useRealtime.ts` to debounce updates | None | PLANNED |
| 2 | SQL Migrations | Create Supabase migration file for `user_settings` additions | None | PLANNED |
| 3 | Sunsama Ritual Overlay & UI Flow | Implement `RitualOverlay.tsx` and integrate with Store, Layout, AppInitializer, Navigation | M1, M2 | PLANNED |
| 4 | UI Polish | Implement Framer Motion swipe-to-delete and react-textarea-autosize | None | PLANNED |
| 5 | End-to-End Verification | Wait for tests and run them, resolve failures | M3, M4 | PLANNED |

## Interface Contracts
### appStore ↔ RitualOverlay
- `activeRitual`: 'morning' | 'evening' | null
- `userSettings`: UserSettings object containing `last_ritual_date`, `shutdown_time`, `daily_capacity_minutes`
- `updateUserSetting(key, value)`: updates setting in state and triggers DB write

### Database Schema (user_settings table)
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
