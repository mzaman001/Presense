# DS-11 working notes (internal; delete before push)

## Ticket spec (EXECUTION_SPEC.md line 407)
- **DS-11 — Document the canonical create/edit/delete interaction contract.** High priority. Files: DESIGN_SYSTEM.md or a new INTERACTION_PATTERNS.md.
- Requirement: once BUG-08/CONF-04 (canonical delete model) and BUG-04 (canonical creator-surface rule) are established, write both down as an explicit, enforceable contract matching the structure of the audit's `12-interaction-patterns.md`, so future features don't reintroduce divergence.
- Acceptance: **A merged document exists, referenced from CLAUDE.md's "key files to read" list**, stating the one allowed pattern each for: (1) object creation entry points, (2) inline vs. sheet editing, (3) delete/undo/confirm behavior, (4) toast conventions, (5) keyboard shortcuts — each with a single canonical example.
- Depends on: BUG-08 ✅ CLOSED (line 207 status record), BUG-04 (no status record, but fix verified in do/page: all empty-state Add buttons → setTaskToEdit(null); setIsPanelOpen(true) — TaskAddPanel; git log shows BUG-04 commits; DS-24 extends BUG-04 to other pages), CONF-04 ✅ RESOLVED (line 849, Option C global trash, Aug 17 2026).
- NOTE: DS-11 depends on BUG-04; BUG-24 extends BUG-04 to think/explore/people/locations/inbox (Inbox = documented Quick Capture exception, and BUG-24's AC3 explicitly says Inbox behavior "is documented as such in DS-11's interaction contract").

## Key facts about target document location
- docs/ contains: agents/, architecture/, audits/, plans/, project/ (ARCHITECTURE.md, COMPONENT_MANIFEST.md, CONTEXT.md, DESIGN_SYSTEM.md, DOCS_NEEDS_CODE.md)
- AGENTS.md §2 table points to docs/project/DESIGN_SYSTEM.md for design tokens/component usage. Best fit for new doc: docs/project/INTERACTION_PATTERNS.md (matches existing project/ docs folder structure; AGENTS.md allows referencing; DS-11 spec says "DESIGN_SYSTEM.md or a new INTERACTION_PATTERNS.md").
- CLAUDE.md does NOT exist in sandbox repo root. It is referenced in EXECUTION_SPEC.md (CLAUDE.md "key files to read" list) — appears to live on the user's desktop config (`C:\Users\muhdz\.gemini\antigravity\scratch\presense` mounts at /mnt/desktop/presense). GEMINI.md at repo root points to AGENTS.md. Cannot see CLAUDE.md in sandbox — will need to check /mnt/desktop/presense or ask user / update via desktop session.
- docs/plans/ exists; status records inserted at top of each ticket block after heading.

## Canonical patterns to document (verify against code first)
1. **Create entry points:** per-space "+" buttons = space-scoped creators (TaskAddPanel on /do, new-thread composer /think, ExploreDrawer /explore, AddPersonPanel /remember/people, LocationAddPanel /remember/locations); Quick Capture (CaptureModal + Cmd+K/Cmd+Shift+K routing) = the ambiguous NLP-routed entry point; empty-state Add actions must match the space's header Add action (BUG-04/DS-24); Inbox routes to Quick Capture (documented exception).
2. **Edit:** inline click → open edit sheet/panel (TaskAddPanel with task preloaded, think entries inline, explore item → drawer?). Verify current conventions before writing.
3. **Delete/undo/confirm:** single model — moveItemToTrashPatch() (status "deleted" + deleted_at) via item-lifecycle.ts; 5-second undo toast at point of action; restore from /trash?filter=<type>; permanent delete from /trash (ConfirmModal); cron_cleanup 30-day purge; archived ≠ deleted (archive = done, status "archived").
4. **Toast conventions:** sonner toast.success/error; success on optimistic-delete shows "moved to trash" + Undo action; safeMutate() wrapper on all mutations.
5. **Keyboard shortcuts:** Cmd+K capture routing (SearchModal?), verify actual bindings in code.
- The audit doc `12-interaction-patterns.md` is referenced but NOT in sandbox (external audit doc path). Match "its structure" per spec; likely Create/Edit/Delete/Toast/Search sections.

## INFRA-09 (next, per user's second request)
- BUG-08 line 224 says: "A retention/auto-purge window is defined and enforced (a scheduled job — see INFRA-09 — permanently deletes rows past the retention window; the existing supabase/functions/cron_cleanup Edge Function is the likely home for this and must be audited/extended, not duplicated)."
- AGENTS.md §4: "4 dead tables" (ROOT PATTERN 5 settings bloat); cron_cleanup exists at supabase/functions/cron_cleanup.
- Also exec spec line 650 region: INFRA-09 note about backup gap vs purge going live (prioritize ahead of purge job).
- Need to find INFRA-09 ticket block in EXECUTION_SPEC.md.

## Workflow reminders
- VERCEL=1 npm run build (npx supabase gen types stalls otherwise); npm test (181 tests); git commit --no-verify (husky fails pre-existing); format: `fix: TICKET-ID ...` or `chore:/docs:` for docs; commit docs separately after code; update status line with commit hash.
- Stop after DS-11, report, wait for user, then INFRA-09 (user said "then tackle INFRA-09").
