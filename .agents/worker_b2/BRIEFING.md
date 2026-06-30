# BRIEFING — 2026-06-29T08:55:00Z

## Mission
Implement Milestone B2 (Centralized RealtimeProvider) in the project.

## 🔒 My Identity
- Archetype: Worker agent
- Roles: implementer, qa, specialist
- Working directory: C:\Users\muhdz\.gemini\antigravity\scratch\presense\.agents\worker_b2
- Original parent: 4fb06d8e-5267-4517-ac38-4e98b3e23541
- Milestone: B2 (Centralized RealtimeProvider)

## 🔒 Key Constraints
- Provide RealtimeContext exposing a subscribe function.
- Maintain a registry of active subscriptions per table using refs.
- When component subscribes: first subscriber registers Supabase channel, subsequent ones just add callback.
- When unsubscribing: decrement refCount, at 0 unsubscribe and remove Supabase channel.
- Do NOT tear down channels or unsubscribe on page visibility changes.
- Export useRealtimeContext.
- Wrap app's components inside src/app/(app)/layout.tsx with RealtimeProvider as a child of QueryProvider.
- No dummy implementations. Do not cheat.

## Current Parent
- Conversation ID: 4fb06d8e-5267-4517-ac38-4e98b3e23541
- Updated: not yet

## Task Summary
- **What to build**: RealtimeProvider client component and useRealtimeContext hook, integrated in (app) layout.
- **Success criteria**: Code compiles, clean subscription management, correctly handles refCount, integration inside (app) layout.
- **Interface contracts**: RealtimeContext signature.
- **Code layout**: src/components/providers/RealtimeProvider.tsx and src/app/(app)/layout.tsx.

## Key Decisions Made
- Created separate test file for RealtimeProvider inside src/components/providers/__tests__/RealtimeProvider.test.tsx.
- Set up a clean reference counting registry in RealtimeProvider using a React useRef.

## Artifact Index
- None

## Change Tracker
- **Files modified**:
  - `src/components/providers/RealtimeProvider.tsx` (Created client component provider and hook)
  - `src/app/(app)/layout.tsx` (Wrapped layout child elements with RealtimeProvider)
  - `src/components/providers/__tests__/RealtimeProvider.test.tsx` (Added unit tests)
- **Build status**: Unknown (Running build and tests)
- **Pending issues**: None

## Quality Status
- **Build/test result**: Unknown
- **Lint status**: Unknown
- **Tests added/modified**: `src/components/providers/__tests__/RealtimeProvider.test.tsx`

## Loaded Skills
- None
