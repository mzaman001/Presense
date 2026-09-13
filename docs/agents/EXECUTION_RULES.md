# Execution Rules — READ THIS BEFORE TOUCHING ANY FILE

> **This file is the contract.** If you are an AI coding agent working on this project, you MUST follow every rule in this file. There is no ticket backlog — see [`docs/QUEUE.md`](../QUEUE.md) for the current state and how work is chosen, per `AGENTS.md` §0. If you cannot follow a rule, STOP and report why.

---

## THE GOLDEN RULE

**You are a surgeon, not a bulldozer.** Every change you make has the potential to break something a user depends on. Act accordingly: small cuts, check vitals between each one, never rush.

---

## THE 7 IRON LAWS

### Law 1: ONE FOCUSED CHANGE AT A TIME
- Pick exactly one well-scoped piece of work, per `AGENTS.md` §0 (read the code, judge what most improves the product) or an active spec under `docs/superpowers/specs/`.
- Make ONLY the changes that piece of work requires.
- Do NOT touch any other file, even if you notice a "quick improvement." Note it and move on.
- Do NOT batch multiple unrelated changes into one edit session.

### Law 2: BUILD AND TEST AFTER EVERY CHANGE
After making a change, BEFORE moving to the next:
```bash
npm run build
```
- If the build FAILS → you broke something. Revert your change. Fix it. Try again. Do NOT move on until the build passes.
- If the build PASSES → run the tests:
```bash
npm test
```
- If tests FAIL → same as above. Fix or revert. Do NOT move on.
- If both pass → commit with a conventional message (`fix:`, `feat:`, `chore:`, `docs:`) describing what changed.

### Law 3: NEVER DELETE WHAT YOU DON'T UNDERSTAND
- Before deleting any file, function, CSS class, or component, grep the entire codebase for its usage:
  ```bash
  grep -rn "theThing" src/
  ```
- If ANY file uses it and you're not 100% sure it's safe to remove → STOP. Leave it. Report it.
- This applies to: CSS classes, exports, components, hooks, utilities, env vars, migration files.

### Law 4: VERIFY BEFORE CLAIMING "DONE"
- NEVER say something is "done" or "fixed" without doing ALL of these:
  1. Reading the actual file you changed (not just the diff — read the full function)
  2. Confirming the build passes (`npm run build`)
  3. Confirming tests pass (`npm test`)
  4. Tracing the user flow mentally: "If I do X, does the fix actually work?"
- If you cannot verify one of these → say "I made the change but could not verify X." Do NOT claim it's fixed.

### Law 5: DO NOT HALLUCINATE
- If you're about to edit a file, READ IT FIRST. Do not edit based on what you "think" it says.
- If a spec or doc references a line number, VERIFY it's still correct before editing. Code shifts.
- If you're unsure how a function works, read it fully before changing it.
- If a doc says "change X to Y" but the code already has Y → report "this is already done" and move on. Do NOT change it to something else.

### Law 6: PRESERVE THE "DO NOT BREAK" LIST
The following are CORRECT and must NOT be modified without a deliberate, documented decision:
- The hover sidebar pattern (`w-[80px] hover:w-[248px] focus-within:w-[248px]`) — the 2026-09-13 design overhaul spec (`docs/superpowers/specs/`) keeps this interaction model, only redesigning its visual treatment
- **Superseded, not preserved:** the three-theme system (`warm`/`navy`/`forest`) is being retired to one theme (light + dark) per the design overhaul spec — do NOT treat the old theme names as a "do not break" item, and do NOT invent new theme names outside that spec's decision
- The `proxy.ts` CSP nonce system (cookie propagation via `cookiesToSet` array)
- The `MotionProvider` with `LazyMotion features={domMax} strict`
- The `RealtimeProvider` shared-channel architecture with 5-second teardown debounce
- The `Sheet` component's drag-to-dismiss with `useVisualViewport` keyboard offset
- The `useBodyScrollLock` ref-counted lock with `data-overlay-open` dataset
- The `rituals.ts` pure-function approach (`getRitualDecision`)
- The `theme.ts` normalizer (`normalizeThemeId`, `normalizeColorMode`, `applyDocumentTheme`)
- The `item-lifecycle.ts` status standardization — never write a second status-writing code path for `items`/`people`/`threads`/`explores`/`locations` outside it
- The `env.ts` returning empty strings (NOT throwing — do NOT make it throw again). Uses `@t3-oss/env-nextjs` with `.catch(() => logAndReturnEmpty(...))` wrapper — do NOT remove the `.catch()` and do NOT configure the library in its default (throwing) mode.

### Law 7: IF UNSURE, STOP AND ASK
- If scope is ambiguous → stop, report the ambiguity, ask for clarification.
- If a fix would require touching more than 3–5 files → stop, report, ask if that's expected.
- If you encounter a bug outside what you're working on → note it but do NOT fix it in the same change.

---

## WORKFLOW (follow exactly)

```
Step 1: Read this file (docs/agents/EXECUTION_RULES.md) completely.
Step 2: Read AGENTS.md and docs/QUEUE.md to understand current state and priorities.
Step 3: If working from a spec (docs/superpowers/specs/), read the relevant section fully before touching code.
Step 4: Pick exactly ONE well-scoped piece of work.
Step 5: Read the actual file(s) you're about to change.
Step 6: Make the change. No more, no less.
Step 7: Run `npm run build`. If it fails, fix or revert.
Step 8: Run `npm test`. If it fails, fix or revert.
Step 9: Commit with a conventional message.
Step 10: Report what you did, what you verified, and any concerns.
```

---

## COMMIT MESSAGE FORMAT

```
fix: add morningDone check before evening ritual trigger
```

- Start with `fix:` for bug fixes, `feat:` for new features, `chore:` for config/tooling, `docs:` for documentation.
- Short description (max ~60 chars) in the imperative.
- If the change touches multiple concerns, use a longer body:
  ```
  fix: fix stale closure in SettingsModal updateSetting

  Read from `next` state inside setSettings() instead of the stale
  `settings` closure. Fixes light mode not visually switching.
  ```

---

## WHAT TO DO IF THE BUILD BREAKS

1. **Do NOT panic.** Do NOT make more changes to "fix" it.
2. Read the error message carefully.
3. If the error is in the file you just edited:
   - Re-read your change. Find what's wrong. Fix it.
   - Re-run `npm run build`.
   - If it still fails after 2 attempts → `git checkout -- <file>` to revert.
   - Report what failed and what the error was.
4. If the error is in a file you DID NOT edit:
   - Do NOT touch that file.
   - Report the unexpected error and stop.

---

## WHAT TO DO IF TESTS FAIL

1. Read the test failure output.
2. If the test is testing the behavior you just changed:
   - The test may be outdated. Update it to match the new (correct) behavior.
   - But ONLY if you're 100% sure the new behavior is correct.
3. If the test is testing unrelated behavior:
   - You may have a side effect. Revert and investigate.
4. If a test was already failing BEFORE your change (pre-existing):
   - Note it. Do NOT try to fix it as part of unrelated work. Move on.

---

## ANTI-PATTERNS (DO NOT DO THESE)

| Anti-pattern | Why it's bad | What to do instead |
|---|---|---|
| "I'll fix everything in one go" | One mistake breaks everything | One focused change at a time |
| "I noticed this other bug, let me fix it too" | Scope creep → breakage | Note it. Stay focused. |
| "This file looks similar, I'll apply the same fix" | Files aren't always similar | Read each file before editing |
| "The build passed, so it must work" | Build ≠ runtime correctness | Trace the user flow mentally |
| "I'll skip the test step, it takes too long" | Tests catch regressions | ALWAYS run tests |
| "Let me refactor this while I'm here" | Refactors break things | Stay focused. Refactor later, deliberately. |
| "This CSS class looks unused, I'll delete it" | It might be used dynamically | Grep first. If unsure, leave it. |
| "I'll make env.ts throw on missing vars" | THIS CRASHED THE ENTIRE SITE | env.ts must NEVER throw at runtime. Also covers: removing the `.catch()` wrapper from `@t3-oss/env-nextjs` in `env.ts`, or configuring `@t3-oss/env-nextjs` in its default (throwing) mode. |
| "I'll skip the `error` check on this Supabase mutation, it's just a quick update" | Silent data loss — this exact bug shipped once (a user saw a success toast while the DB write silently failed). | Always destructure `{ error }` and check it. Client: use `safeMutate(mutationFn, errorLabel)` from `src/lib/supabase.ts`. Server components: no toast — check `error` and log. |
| "I'll delete this file, it's unused" | Deletion is irreversible | Never delete without grepping + confirming |

---

## THE STOP LIST

If you encounter ANY of these, STOP IMMEDIATELY and report to the user. Do NOT attempt to fix:

1. A migration that drops a column (`ALTER TABLE ... DROP COLUMN`)
2. A change to `proxy.ts` that removes the CSP header
3. A change to `MotionProvider` that removes `LazyMotion` or `strict`
4. A change that makes `env.ts` throw at runtime (instead of returning empty string) — including removing the `.catch()` wrapper around `@t3-oss/env-nextjs` that currently prevents it from throwing, or configuring `@t3-oss/env-nextjs` in its default (throwing) mode
5. A change to the RLS policies that removes `(select auth.uid()) = user_id`
6. A change to the Supabase service-role key usage in `/api/account`
7. Deletion of any file in `src/components/ui/` without grepping for usage first
8. Deletion of any migration file in `supabase/migrations/`
9. A change that touches more than 5 files for a single piece of work
10. Any change to `package.json` that removes a dependency
11. A new Supabase mutation (`.insert()`/`.update()`/`.delete()`) that does not destructure and check the returned `error` — see invariant 6 in `AGENTS.md`.

---

## VERIFICATION CHECKLIST (before claiming something is done)

- [ ] I read the actual file, not just a description of the change
- [ ] I made ONLY the change that was scoped
- [ ] I did NOT touch unrelated files
- [ ] `npm run build` passes
- [ ] `npm test` passes (or I noted which tests were pre-existing failures)
- [ ] I traced the user flow mentally and the fix makes sense
- [ ] I committed with the correct message format
- [ ] I reported what I did and any concerns

If ANY box is unchecked, the work is NOT done. Do NOT claim it is.

---

## FINAL NOTE

The previous AI agent broke this app by doing too much at once, not testing, and not reading the code before editing. That will NOT happen again. Follow these rules exactly. If you can't, stop and report.

**Slow is smooth. Smooth is fast.**
