# E2E Test Infra: Phase 4 Requirements

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Methodology: Category-Partition + BVA + Pairwise + Workload Testing.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | useRealtime hook debouncing | ORIGINAL_REQUEST §1 | 5      | 5      | ✓      |
| 2 | Sunsama morning/evening rituals | ORIGINAL_REQUEST §2 | 5      | 5      | ✓      |
| 3 | Fluid swipe-to-delete mechanics | ORIGINAL_REQUEST §3 | 5      | 5      | ✓      |
| 4 | Auto-growing textareas | ORIGINAL_REQUEST §4 | 5      | 5      | ✓      |

## Test Architecture
- Test runner: Vitest (invoked via `npx vitest run src/lib/__tests__/phase4.test.tsx` or similar)
- Test case format: Vitest integration tests using React Testing Library to render components, mock user interactions, and check DOM assertions.
- Directory layout:
  - Source components under `src/`
  - Integration test file: `src/lib/__tests__/phase4.test.tsx`

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Realtime updates debouncing under burst database changes | F1 | Medium |
| 2 | Sunsama Morning ritual stack triage and workflow setup | F2 | High |
| 3 | Sunsama Evening review with Pomodoros tally & carrying over tasks | F2 | High |
| 4 | Deleting items across Inbox, Explore, and People lists via swipe gestures | F3 | Medium |
| 5 | Textarea auto-growing on rapid text input and expansion | F4 | Low |

## Coverage Thresholds
- Tier 1: ≥5 per feature (Total 20)
- Tier 2: ≥5 per feature (Total 20 boundary cases)
- Tier 3: pairwise coverage of major feature interactions
- Tier 4: ≥5 realistic application scenarios
