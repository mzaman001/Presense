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
