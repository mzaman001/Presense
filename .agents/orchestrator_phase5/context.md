# Context Information - Phase 5 (Edge Auth & UUID Cross-Linking)

## Workspace Directory
- `C:\Users\muhdz\.gemini\antigravity\scratch\presense`

## Key Files to Create / Modify
- `src/middleware.ts` (new middleware file)
- `supabase/migrations/<timestamp>_add_linked_people.sql` (new migration file)
- `src/components/features/CaptureModal.tsx` or similar capture UI components (to modify for Mentions)
- `src/components/features/Think/` components (to modify for Mentions)

## Environment Variables
Defined in `.env` and `.env.local`:
- Supabase Project URL and Keys
- Server settings

## External Dependencies
- `@supabase/ssr` (for middleware)
- `@supabase/supabase-js`
- `react-textarea-autosize` (if used)
- Framer Motion, lucide-react
