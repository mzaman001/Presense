<div align="center">

  <img src="public/icon.svg" alt="Presense" width="120" />

  <h1>Presense</h1>

  <p><strong>An opinionated, deeply immersive ecosystem for your mind.</strong></p>

  <p>A productivity app that refuses to be another infinite canvas. Built on cognitive science principles to keep you executing, not organizing.</p>

  [![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
  [![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

</div>

---

## Why Presense?

Apps like Notion and Obsidian give you an infinite canvas. While powerful, they inevitably turn you into a systems architect rather than an executor. You spend hours designing databases, tweaking layouts, and organizing pages instead of actually doing the work.

**Presense is the antithesis of the infinite canvas.**

It is a deeply opinionated, structural extension of your mind. It does not want you to build a system — it *is* the system. Built on principles of cognitive science, Presense enforces boundaries, automated cleanup, and psychological framing to ensure your workspace remains a pristine tool for action and reflection.

---

## Architecture of Thought

Your mind processes different types of information differently. Presense mirrors this reality by partitioning your life into four distinct, interconnected spaces:

| Space | Purpose | Philosophy |
|:---:|:---|:---|
| **Do** | Action | **Implementation Intentions.** Not tasks, but "If-Then" anchors. You define exactly *where* and *when* an action happens. What matters is the starting friction, not the outcome. |
| **Think** | Reflection | **Threaded Consciousness.** Not documents, but conversations with yourself. Long-term ideas, daily journals, and profound thoughts live in continuous, searchable threads that resurface organically. |
| **Remember** | Relationships | **Contextual Empathy.** A lightweight personal CRM. When you meet someone, you instantly see what you talked about last time, their birthday, and any shared tasks. |
| **Explore** | Knowledge | **Curated Consumption.** A holding zone for articles, books, and links. If it sits untouched, the automated 30-day archive cycle sweeps it away to prevent digital hoarding. |

---

## Features

### Universal NLP Capture
Hit `Cmd+K` anywhere. Type *"Meet Sarah about the design at 2pm tomorrow"*. Presense's local Natural Language Processing instantly extracts the date, identifies the person, and routes the thought perfectly — no dropdown menus required.

### Deep-Focus Pomodoro
When it's time to execute, Presense transforms. A fullscreen, immersive focus environment takes over with dynamic SVG progress rings, ambient glowing backgrounds, and configurable intervals. Distractions are hidden; only the current task exists.

### Bespoke Glassmorphic UI
Built with intense attention to visual hierarchy. Translucent layers, fluid micro-interactions, and curated themes (Wahala, Deep Navy, Forest) ensure the app feels alive and reactive to your touch.

### Realtime Everything
Every list, every count, every status updates instantly across all spaces. No page refreshes. No stale data. Your workspace stays in sync with your mind.

### Aggressive Auto-Cleanup
A workspace should be clean. Supabase Edge Functions enforce a strict 30-day soft-delete cycle for stale items, forcing you to engage with your data or let it go.

### Smart Task Routing
Recurring patterns, deadlines, locations, and relationships are all detected from natural language. *"Every Monday and Wednesday see Max"* creates a recurring task with the right schedule automatically.

---

## Tech Stack

| Layer | Technology |
|:---|:---|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4, Framer Motion |
| State | Zustand |
| Backend | Supabase (PostgreSQL, Auth, Realtime, Edge Functions) |
| NLP | compromise.js (local, zero API costs) |
| UI Components | Custom glassmorphic design system |

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Supabase** project (free tier works)
- **npm** or equivalent package manager

### 1. Clone & Install

```bash
git clone https://github.com/mzaman001/Presense.git
cd Presense
npm install
```

### 2. Environment Variables

Create a `.env.local` file at the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Database Setup

Run the SQL migrations to set up your schema, policies, and functions:

```bash
npx supabase db push
```

### 4. Run

```bash
npm run dev
```

Navigate to [http://localhost:3000](http://localhost:3000) to enter your new mind.

---

## Project Structure

```
src/
├── app/              # Next.js App Router pages
├── components/       # React components (UI primitives + features)
├── hooks/            # Custom React hooks
├── lib/              # Utilities, Supabase client, NLP router
└── store/            # Zustand state management
supabase/
├── functions/        # Edge Functions (auto-cleanup, weekly tasks)
└── migrations/       # SQL schema migrations
```

---

## Design Philosophy

Presense follows four pillars:

1. **Atmosphere over flatness** — Every background has ambient light, every card has surface shimmer. The app exists in an environment, not on a blank canvas.

2. **Warmth at the centre** — The accent family is always warm: amber, coral, deep orange. Cool colours appear only as secondary accents.

3. **Glass as the language of depth** — Cards, panels, modals, toasts — everything is a glass surface floating in the atmospheric background.

4. **Inter carries the voice** — All type is Inter. Confident where it matters, restrained where it supports.

---

## Contributing

Contributions are welcome. Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

<div align="center">
  <p><em>"Your mind is for having ideas, not holding them."</em></p>
  <p><strong>Presense</strong> — Built with purpose.</p>
</div>
