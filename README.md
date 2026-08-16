<div align="center">
  <img src="public/icon.svg" alt="Presense" width="96" />
  <h1>Presense</h1>
  <p>A personal task, note, and relationship organizer with natural-language capture, realtime sync, and a calm, warm design. Self-hosted on Supabase.</p>
</div>

## What it is

Presense is a single-user web app that organizes four kinds of things in four spaces: **Do** for tasks, **Think** for threads of notes, **Remember** for people and locations, and **Explore** for a reading queue. Captures come in through one command (Ctrl+K), get parsed client-side for dates and people, and are routed to the right space automatically. Deleted items go to a global trash and are purged after 30 days. Nothing is sent to an LLM API — all parsing runs in the browser.

<!-- Screenshot placeholder — uncomment and point at a real screenshot, e.g. docs/assets/screenshot-home.png -->
<!-- <p align="center"><img src="docs/assets/screenshot-home.png" alt="Presense home dashboard" width="900"/></p> -->

## Key features

- **Natural-language capture** — Type "Meet Sarah about the design at 2pm tomorrow" and the date, person, and space are extracted locally with compromise.js and chrono-node.
- **Four spaces, one inbox** — Tasks, threads, people/locations, and reading items each get a dedicated view; unrouted captures land in an inbox you clear deliberately.
- **Realtime across devices** — Supabase Realtime keeps every list, count, and status in sync; changes appear without a refresh.
- **Soft-delete with 30-day recovery** — Everything deleted goes to a global trash (`/trash`) and is automatically purged by an edge-function cron job after 30 days.
- **Three themes, six modes** — Warm (default), Navy, and Forest, each in dark and light, applied through CSS custom properties.
- **Deep-focus mode** — A fullscreen Pomodoro timer with configurable intervals.
- **Installable PWA** — Serwist service worker with offline fallback and update prompts.
- **Keyboard-first** — Global search (Ctrl+K), capture from anywhere, and shortcut-driven navigation.

## Getting started

Requires **Node.js 20+**, a free [Supabase](https://supabase.com) project, and npm.

```bash
git clone https://github.com/mzaman001/Presense.git
cd Presense
npm install
cp .env.example .env.local   # fill in your Supabase URL and anon key
npx supabase link --project-id <project_id>
npx supabase db push
npm run dev                  # http://localhost:3000
```

The schema is 29 migrations pushed with `db push`. For production, deploy the two edge functions (`cron_cleanup`, `cron_recurrence`) and schedule them from the Supabase dashboard — see `docs/architecture/` for the full setup guide.

## Stack

Built with [Next.js 16](https://nextjs.org) (App Router), [React 19](https://react.dev), TypeScript strict, and [Tailwind CSS 4](https://tailwindcss.com). State lives in Zustand (client) and TanStack Query (server), with Supabase for Postgres, Auth, and Realtime. Natural-language capture uses compromise and chrono-node; the PWA layer is Serwist; errors in production go to Sentry.

| Area | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Backend | Supabase (Postgres, Auth, Realtime, Edge Functions) |
| State | Zustand 5 · TanStack Query 5 |
| Styling | Tailwind CSS 4 + Framer Motion 12 |
| Capture | compromise 14 + chrono-node 2 (client-side) |
| PWA | Serwist 9 |
| Testing | Vitest 4 (181 tests) + Playwright |
| CI | GitHub Actions: lint, typecheck, tests, build, osv-scanner, semgrep |

Architecture details, the data model, and the design system are documented under [`docs/`](docs/).

## Roadmap

Open work is tracked in [`docs/plans/EXECUTION_SPEC.md`](docs/plans/EXECUTION_SPEC.md); new issues go in [GitHub Issues](https://github.com/mzaman001/Presense/issues). The short-term focus is the remaining high-priority UI bugs (see Issues), followed by design-system consolidation.

## Contributing

Presense has a strict one-ticket-at-a-time development contract, written for both humans and AI agents. Before opening a PR, read [`AGENTS.md`](AGENTS.md) (the entry point) and [`docs/agents/EXECUTION_RULES.md`](docs/agents/EXECUTION_RULES.md) (the rules: one ticket per session, build + test after every change, conventional commits, status records in `EXECUTION_SPEC.md`). Pick an unblocked ticket from the spec, create a branch named after the ticket ID, and open a PR.

---

*Two housekeeping items: (1) this README has a screenshot placeholder — add one or two real screenshots (the home dashboard and do board are the strongest candidates) and uncomment the image reference above; (2) the repository has no `LICENSE` file, so no license badge is shown — add an MIT `LICENSE` file at the repo root if you intend to publish under MIT (the previous README advertised MIT).*
