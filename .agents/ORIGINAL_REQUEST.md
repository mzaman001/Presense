# Original User Request

## Initial Request — 2026-06-21T12:53:14Z

Conduct a comprehensive static analysis and audit of the "Presense" web app for performance, accessibility, security, SEO, and testing, generating a structured report with recommended patches.

Working directory: `C:\Users\muhdz\.gemini\antigravity\scratch\presense`
Integrity mode: development

## Requirements

### R1. Static Analysis & Linting
Run static analysis for performance, SEO, and accessibility using linters (e.g., eslint) and static code checks. Do not use heavy external tools like Lighthouse or ZAP.

### R2. Security & Vulnerability Scans
Run `npm audit` and static security analysis on the codebase.

### R3. Testing & Local Server
Run whatever existing unit/E2E tests are currently in the repo (skip if none exist). If any remaining static analysis tools require a live server, spin up the local Next.js dev server (`npm run dev`) to test against it.

### R4. Audit Report
Generate a detailed, structured report (JSON or markdown) listing each issue with its severity and recommended code fixes (e.g., parameterizing queries, adding alt text).

## Acceptance Criteria

### Audit Completeness
- [ ] Report includes sections for Static Analysis (Performance/Accessibility/SEO), Security, and Testing.
- [ ] Each identified issue includes a severity rating and a concrete recommended code patch/snippet.
- [ ] `npm audit` and static linters were successfully executed against the codebase.

## Follow-up — 2026-06-21T11:01:06Z

<USER_REQUEST>
# Teamwork Project Prompt — Draft

> Status: Launched

A comprehensive UX and Product strategy research report that studies top-tier apps (Todoist, Sunsama, TickTick, Zen Browser, Things 3, Capacities, Craft) against the 18 specific issues provided by the user. The output will be a detailed markdown artifact listing similar potential issues, missing features, recommended removals, and best-in-class workarounds for the Presense app.

Working directory: .
Integrity mode: development

## Requirements

### R1. Deep Codebase Analysis First
Before researching external apps, the team MUST thoroughly explore the local `presense` codebase (specifically the components, routing, and UI flows mentioned in the user's 18 issues: `Inbox`, `CaptureModal`, `TaskCard`, `SettingsModal`, `ExploreDrawer`, `ThinkThread`). The team must understand how the app is currently built.

### R2. Analyze the User's 18 Issues
Based on the codebase audit, the team must thoroughly analyze the 18 specific UX/UI and product issues provided by the user (e.g., missing location routing in the Inbox dropdown, laggy snooze updates, clunky Think thread transitions, confusing settings like "Routing Confidence", overlapping avatars in task cards, and redundancy between Types/Tags in Explore).

### R3. Deep Industry Research via Web Search
The team must actively search the live web to study top-tier apps matching the user's domain (specifically: Todoist, Sunsama, TickTick, Zen Browser, Things 3, Capacities, and Craft). Focus on how these apps implement frictionless capture, manage settings complexity, handle visual hierarchy, and optimize performance (optimistic UI).

### R4. Synthesize the Research Report
The team must synthesize their findings into a comprehensive Markdown artifact (`presense_ux_research_report.md`). Based on the study of these top apps and the reality of the current codebase, the report must extrapolate and list similar potential issues, errors, features, recommended changes, and removals for the Presense app.

## Acceptance Criteria

### Verification (Agent-as-Judge Rubric)
- [ ] The final output is a Markdown artifact named `presense_ux_research_report.md`.
- [ ] The report explicitly references the specific UX/UI flows of at least 4 of the requested apps (e.g., Sunsama's daily planning, Capacities' object-based taxonomy, Things 3's visual hierarchy, Craft's block styling) using information gathered from live web searches.
- [ ] The report maps the user's original 18 issues to broader product/design paradigms and proposes concrete, actionable solutions or feature removals.
- [ ] The report proposes an extrapolated list of *new* potential issues or recommended feature changes inspired by the top-tier apps that go beyond the user's initial 18 points.
</USER_REQUEST>

## Follow-up — 2026-06-21T12:12:47Z

<USER_REQUEST>
# Teamwork Project Prompt — Draft

> Status: Launched

Implement the UX/UI and backend fixes outlined in the newly generated `presense_ux_research_report.md` to resolve the 18 specific issues in the Presense app codebase.

Working directory: .
Integrity mode: demo

## Requirements

### R1. Analyze the UX Research Report
The team must read the `presense_ux_research_report.md` artifact in the project root to understand the 18 specific issues and the roadmap. The focus of this project is exclusively **Phase 1 (Database Normalization & State Reliability)** and **Phase 2 (Core UX Hardening)**. Do not implement Phase 3.

### R2. Execute Phase 1: State Reliability
Refactor the triage and space-routing logic. Instead of executing direct row deletions (`supabase.from('items').delete()`) when routing an item from the Inbox to another space, implement soft-deletions or state transitions. Consolidate category save operations in the Settings Modal to prevent DB sync race conditions.

### R3. Execute Phase 2: Core UX Hardening
Fix all UI/UX bugs identified in Phase 2 of the report:
1. Normalize UTF-8 characters (replace `â†’` with `→` or `lucide-react` icons).
2. Replace custom `e.stopPropagation()` dropdowns with robust primitives (like Radix UI or Headless UI) in `ExploreDrawer` and `Inbox`.
3. Fix the `JSON.stringify` performance bottleneck inside `TaskCard.tsx`'s `React.memo` by using a shallow primitive comparison.
4. Implement Optimistic UI updates for Task Snoozing and Task Deletions to eliminate the 5-second latency.

## Acceptance Criteria

### Verification (Agent-as-Judge Auditing)
- [ ] No garbage encoding characters (e.g., `â†’`, `ðŸ“Œ`) remain in any `src/` component.
- [ ] The `TaskCard` component no longer uses `JSON.stringify` inside its memoized props comparison function.
- [ ] The Inbox `Route it` dropdown has been expanded to include the "Remember → Locations" destination.
- [ ] Moving an item from the Inbox no longer triggers a hard SQL `.delete()` on the items table, but instead performs a safe state-transition or update.
- [ ] UI latency for snoozing a task feels instantaneous due to optimistic client-side cache updates.
</USER_REQUEST>
