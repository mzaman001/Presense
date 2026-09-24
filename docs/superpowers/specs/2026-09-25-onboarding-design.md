# Onboarding and first run — design

Date: 2026-09-25 · Branch: `feat/onboarding-first-run`

## Goal

A new user ends onboarding having run the core loop once: empty their head,
sort it, shape the day, and land in the focus view for a task they chose
(ready state; nothing counts down until they press Start). Patterned on
Sunsama (first plan is the onboarding) and Todoist (one question per screen,
profile first, "You're all set").

## Rules

- Use the app's existing names: Morning planning, Evening review, Daily
  capacity, Plan my day, Start my day, Quick Capture, Light / Dark / System,
  Today / Tomorrow / Someday. No new modes or terms.
- Name is required.
- Plain, friendly copy; no feature explanations.

## Wizard (`/onboarding`), one question per screen

| # | Screen | Sets |
|---|---|---|
| 1 | Welcome — "Clear your head. Get going." CSS/SVG loop of capture → plan → start. "Get started". | — |
| 2 | "What should we call you?" Required. | `display_name` |
| 3 | "How should Presense look?" Light / Dark / System cards, applied live. Default System. | `color_mode` |
| 4 | "When do you like to plan your day?" (Morning planning) Default 08:00. | `nudge_time` (exact; fixes old +30 min offset) |
| 5 | "When do you usually call it a day?" (Evening review) Default 18:00. | `shutdown_time` |
| 6 | "How much time do you usually have for your own things?" (Daily capacity) 2h/4h/6h/8h. Default 4h. | `daily_capacity_minutes` |
| 7 | "Let's plan your first day." "Plan my day" or "Skip for now". | `timezone`, `onboarding_complete` |

- Each answer is saved when the user continues. The current step is kept in
  `sessionStorage`, so a refresh resumes. A failed save keeps the user on the
  screen (toast; they can retry).
- Back on every screen after 1. Enter advances. Progress bar across 2–7.
- Motion: CSS transitions only, disabled under `prefers-reduced-motion`.

## First run in the app

- "Plan my day" on screen 7 sets `localStorage["presense_first_run"]="1"`
  and routes to `/`. `AppInitializer` sees the marker and opens the morning
  ritual immediately, bypassing the time window and snooze.
- The ritual reads the marker (`isFirstRun`). Changes when it is set:
  - Step 0 heading: "Good morning, {name}." / "Let's plan the day, {name}."
    Continue needs at least one captured item.
  - "Start my day" opens the focus view (existing `setActiveTimer`, ready
    state) on the first task planned for today, or on the task the user
    tapped in "Shape your day". With no tasks for today it closes normally.
- The marker is cleared when the ritual completes or is closed. Afterwards a
  one-time "You're all set" card shows on Home (Quick Capture incl. voice and
  share, Evening review at their time, no streaks), dismissed permanently
  via `localStorage["presense_welcome_card_dismissed"]`.
- "Skip for now" completes onboarding without the marker.

## Verification

- Unit: time formatting (no offset), wizard step persistence, name required,
  first-run marker lifecycle, ritual first-run behaviour.
- Playwright + Axe on the wizard screens (seeded test account).
- Gates: lint, tsc, `npm test`, build, `npm audit`; screenshots in Light and
  Dark, mobile and desktop.
