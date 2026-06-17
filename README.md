<div align="center">

  <img src="public/icon.svg" alt="Presense" width="100" />

  <h1>Presense</h1>

  <p><strong>A second brain that refuses to be another infinite canvas.</strong></p>

  <p>Built on cognitive science principles to keep you executing, not organizing.</p>

  <br />

  <a href="https://github.com/mzaman001/Presense/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-7692FF?style=flat-square" alt="License">
  </a>
  <a href="https://github.com/mzaman001/Presense/stargazers">
    <img src="https://img.shields.io/github/stars/mzaman001/Presense?style=flat-square&color=FBBF24" alt="Stars">
  </a>
  <a href="https://github.com/mzaman001/Presense/pulse">
    <img src="https://img.shields.io/github/commit-activity/m/mzaman001/Presense?style=flat-square" alt="Commit Activity">
  </a>
  <a href="https://github.com/mzaman001/Presense/issues">
    <img src="https://img.shields.io/github/issues/mzaman001/Presense?style=flat-square" alt="Issues">
  </a>

</div>

---

## What is Presense?

Most productivity apps give you an infinite canvas. You end up spending hours building systems instead of doing the work. Presense is the opposite — it **is** the system.

Four spaces. Zero configuration. One clear mind.

| | Space | What it does |
|:---:|:---|:---|
| <img src="https://img.shields.io/badge/Do-FBBF24?style=flat-square" /> | **Do** | Tasks with implementation intentions. Not a checklist — a commitment engine. |
| <img src="https://img.shields.io/badge/Think-2DD4BF?style=flat-square" /> | **Think** | Threaded thoughts that resurface. Daily notes, journals, ideas — all in continuous threads. |
| <img src="https://img.shields.io/badge/Remember-7692FF?style=flat-square" /> | **Remember** | Lightweight personal CRM. Know who you met, what you discussed, and what's next. |
| <img src="https://img.shields.io/badge/Explore-FBBF24?style=flat-square" /> | **Explore** | Curated reading queue. Auto-archives after 30 days — engage or let go. |

---

## Features

**Natural Language Capture** — Hit `Cmd+K`. Type *"Meet Sarah about the design at 2pm tomorrow"*. Local NLP (zero API costs) extracts the date, person, and context automatically.

**Deep-Focus Pomodoro** — Immersive fullscreen focus mode with SVG progress rings, configurable intervals, and ambient backgrounds. Distractions vanish; only the task remains.

**Smart Routing** — Inbox items route to any space with one click. Undo support on every action. Recurring patterns, deadlines, and relationships detected from natural language.

**Realtime Sync** — Every list, count, and status updates instantly across all spaces via Supabase Realtime. No refreshes. No stale data.

**Aggressive Cleanup** — Edge Functions enforce a 30-day soft-delete cycle. Your workspace stays pristine or your data goes.

**Bespoke Glassmorphic UI** — Atmospheric backgrounds, translucent glass surfaces, warm amber accents, and fluid micro-interactions. The app feels alive.

---

## Quick Start

### Prerequisites

- **Node.js** 18+
- **Supabase** project ([free tier](https://supabase.com/pricing) works)
- **npm**, **yarn**, or **pnpm**

### Setup

```bash
# 1. Clone
git clone https://github.com/mzaman001/Presense.git
cd Presense

# 2. Install
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase URL and anon key

# 4. Set up database
npx supabase db push

# 5. Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Tech Stack

| Layer | Technology |
|:---|:---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| UI | [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/) |
| State | [Zustand](https://zustand-demo.pmnd.rs/) |
| Backend | [Supabase](https://supabase.com/) (PostgreSQL, Auth, Realtime, Edge Functions) |
| NLP | [compromise.js](https://github.com/spencermountain/compromise) (local, zero API costs) |
| Testing | [Vitest](https://vitest.dev/) |

---

## Design Philosophy

> *Presense feels like a warm lamp in a dark room.*

Four pillars shape every design decision:

1. **Atmosphere over flatness** — Every background has ambient light, every card has surface shimmer. The app exists in an environment, never on a blank canvas.

2. **Warmth at the centre** — Amber, coral, deep orange. Cool colours appear only as secondary accents. The default experience is warm.

3. **Glass as the language of depth** — Cards, panels, modals, toasts — everything is a glass surface floating in the atmospheric background.

4. **Inter carries the voice** — Confident where it matters, restrained where it supports. No font mixing except JetBrains Mono for numeric data.

---

## Project Structure

```
src/
├── app/                  # Next.js App Router
│   ├── (app)/            #   Authenticated pages (home, do, think, explore, inbox)
│   ├── (auth)/           #   Login flow
│   ├── api/              #   API routes (capture, people, reorder)
│   └── onboarding/       #   First-run wizard
├── components/
│   ├── features/         #   Domain components (TaskCard, SearchModal, etc.)
│   ├── layout/           #   Shell (Sidebar, Navigation, AmbientBackground)
│   └── ui/               #   Primitives (GlassCard, Badge, Dropdown, etc.)
├── hooks/                # Custom React hooks
├── lib/                  # Utilities, Supabase client, NLP router
└── store/                # Zustand state management
supabase/
├── functions/            # Edge Functions (auto-cleanup, weekly tasks)
└── migrations/           # SQL schema migrations
```

---

## Scripts

| Command | Description |
|:---|:---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run test` | Run test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint with ESLint |

---

## Contributing

Contributions are welcome. Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

For bugs and feature requests, [open an issue](https://github.com/mzaman001/Presense/issues).

---

## License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

<div align="center">
  <p><em>"Your mind is for having ideas, not holding them."</em></p>
  <br />
  <p><strong>Presense</strong> — Built with purpose.</p>
</div>
