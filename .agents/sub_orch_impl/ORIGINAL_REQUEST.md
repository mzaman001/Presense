# Original User Request

## 2026-06-27T12:58:58Z

You are teamwork_preview_orchestrator acting as the Implementation Track Orchestrator for Phase 4.
Your working directory is C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\sub_orch_impl.
Your mission is to implement all Phase 4 (Sunsama Rituals & UI Polish) requirements based on the global ORIGINAL_REQUEST.md.

Requirements to implement:
1. Pre-requisite: Realtime Hook Fix:
   - Fix `src/hooks/useRealtime.ts` to debounce updates and handle burst writes without 2.5s lockouts.
2. SQL migrations:
   - Create a new migration file under `supabase/migrations/` adding:
     * `last_ritual_date` (date) to `user_settings`
     * `shutdown_time` (string/time, default '18:00') to `user_settings`
     * `daily_capacity_minutes` (int, default 240) to `user_settings`
3. Sunsama morning/evening rituals:
   - Build `src/components/features/RitualOverlay.tsx` controlled by `activeRitual` state in `useAppStore`.
   - Embed this overlay in `src/app/(app)/layout.tsx`.
   - Auto morning trigger in `AppInitializer.tsx` (`now() > nudge_time` and `last_ritual_date != today`).
   - Auto evening trigger in `AppInitializer.tsx` (`now() > shutdown_time`).
   - Manual trigger "Plan my day" button in sidebar (`Navigation.tsx`).
   - Morning flow: Step 1: Triage inbox/overdue tasks stack; actions: "Do today", "Push to backlog", "Snooze". Cannot skip if items exist. Step 2: Commit tasks with minute estimates, <WorkloadBar /> showing soft capacity warning if sum > daily_capacity_minutes. Step 3: Write last_ritual_date = today, close overlay, land on Home page.
   - Evening flow: Panel for completed tasks today & focus minutes, incomplete carry-overs (bumps deadline by 1 day). Text highlight box appends to today's Daily Note thread.
4. UI Polish:
   - Fluid swipe-to-delete mechanics using Framer Motion (like `TaskCard.tsx`) on Inbox, Explore, and People lists.
   - Replace static textareas for notes/tasks with `react-textarea-autosize`.

Your implementation must pass 100% of the E2E tests built by the Testing Track (located at `src/lib/__tests__/phase4.test.tsx` and run via `npm test`).
Follow the standard Project Orchestrator procedure (Assess -> Decompose or Iterate).
Your parent is C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\orchestrator_phase4 (Conv ID: befcb77f-0ef7-487e-a7ba-09134a7c1008). Send progress and completion updates back using send_message.
