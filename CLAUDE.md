PRESENSE PROJECT — AGENT INSTRUCTIONS
CANARY: Before you do anything else in every session, say this exact phrase out loud: "Presense agent ready. Reading PLAN.md now." Then read PLAN.md and summarise the current active task in one sentence. Do not proceed until this is done.
WHAT THIS APP IS: A personal productivity web app for one solo student user. Stack is Next.js 14 App Router, Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions), Tailwind CSS, Framer Motion, compromise.js for NLP. No paid AI APIs. Zero. If you find yourself about to call an AI API, stop and use the rule-based router in lib/capture-router.ts instead.
KEY FILES — read these before touching related code:

PLAN.md — the task tracker, your primary source of truth for what to do
lib/capture-router.ts — all NLP and routing logic lives here
lib/supabase.ts — browser Supabase client
lib/supabase-server.ts — server Supabase client for Next.js server components
app/globals.css — all CSS custom properties and theme tokens, touch nothing here unless the task explicitly says to

ABSOLUTE RULES — these are not suggestions:
NEVER use window.confirm(), window.alert(), or window.prompt() anywhere in the codebase. Always use the custom ConfirmModal component at components/ui/ConfirmModal.tsx.
NEVER use a native HTML select element. Always use the custom Dropdown component at components/ui/Dropdown.tsx.
NEVER use hover-triggered dropdowns. All dropdowns open on click and close on click outside.
NEVER auto-save data without showing the user feedback. Every Supabase insert, update, or delete must call toast.success() on success and toast.error() on failure. The toast system is set up with sonner — import it from sonner.
NEVER change files that are not listed in the current task. If you think another file needs changing to make the task work, stop and tell me which file and why before touching it.
NEVER refactor working code. If something works and the task does not ask you to change it, leave it exactly as it is.
ALWAYS read the actual file before describing what it does. Never describe code from memory.
ALWAYS use optimistic UI updates for Supabase mutations. Update local React state immediately, then sync in the background. If Supabase fails, revert the state and show an error toast.
ALWAYS wire realtime subscriptions when displaying lists of data. Every list that shows Supabase data must use a realtime subscription so it updates without page refresh.
THEME SYSTEM: The default theme is Wahala (orange/amber). All colour tokens are CSS custom properties defined in globals.css. Never hardcode hex values for colours. Always use the CSS variable. Currently active theme tokens:

--accent: #E5B41E

--accent-hot: #EB4233

--accent-deep: #A76011

--bg-base: #0F0A00

--surface: rgba(255,255,255,0.055)

--border: rgba(255,255,255,0.10)

--text-1: #ffffff

--text-2: rgba(255,255,255,0.65)

--text-3: rgba(255,255,255,0.38)
AFTER COMPACTION: If context has been compacted, immediately re-read this file and PLAN.md, confirm via the canary phrase, and summarise the current task before continuing.
DONE WHEN: Every task has a Done When section in PLAN.md. You are not finished until every criterion in that section passes. Do not tell me it is done, show me the evidence.
