<div align="center">
  <img src="https://via.placeholder.com/1500x500/13111C/FFFFFF?text=PRESENSE" alt="Presense Banner" width="100%" style="border-radius: 12px;" />

  <br />
  <br />

  # 🧠 Presense — Your External Brain
  **A premium, unified ecosystem that acts as an extension of your mind.**
  <br />

  [![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
  [![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Framer Motion](https://img.shields.io/badge/Framer_Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white)](https://www.framer.com/motion/)

  <p align="center">
    <a href="#-the-five-spaces">The Five Spaces</a> • 
    <a href="#-premium-features">Premium Features</a> • 
    <a href="#-installation--setup">Setup</a> • 
    <a href="#-architecture">Architecture</a>
  </p>
</div>

---

## 🌌 The Problem with Productivity
Traditional productivity apps suffer from extreme siloing. Your tasks live in one app, your notes in another, and your contacts in a CRM you never check. You spend more time managing the system than executing.

**Presense breaks this.** By combining five distinct spaces into a single, seamless ecosystem connected by an intelligent NLP capture router, Presense stops being a to-do list and becomes your external brain.

---

## 🧭 The Five Spaces

| Space | Focus | Description | Highlight Feature |
|:---:|:---|:---|:---|
| ⚡ **Do** | Action | Tasks that move. Focus on the smallest physical step to start, not just the outcome. | *If-Then Anchoring* & *Start Date filtering* |
| 💭 **Think** | Reflection | Thoughts that stay. Threaded, continuous journaling that builds a mental repository over time. | *Auto-generated Daily Notes* |
| 👥 **Remember** | Relationships | A personal, lightweight CRM. Log what people tell you and exactly where you left your passport. | *Contextual Meeting Briefings* |
| 🧭 **Explore** | Knowledge | Things worth keeping. Save links, books, and concepts for later processing. | *Cross-space linking to Think threads* |
| 📊 **Dashboard** | Focus | A centralized hub displaying your active focus tasks, today's meetings, and weekly Pomodoro stats. | *Bento-grid Hero UI* |

---

## ✨ Premium Features

> **Universal NLP Capture**
> Type *"Meeting with Max next Tuesday at 2pm"* from anywhere in the app. Presense automatically extracts the date, creates the entry, and routes it to the correct space using local rule-based intelligence.

> **If-Then Anchoring**
> Stop setting vague goals. Define the exact physical location and time you will start a task (e.g., *"When I sit at my desk after dinner, I will open Chapter 3"*).

> **Immersive Focus Sessions**
> A deeply immersive, fullscreen Pomodoro timer featuring dynamic SVG progress rings, ambient glowing backgrounds, and configurable durations.

> **The Archive Ecosystem**
> Built for speed. A unified 30-day soft-delete cycle with nightly Edge Functions for permanent cleanup, keeping your active workspace pristine and lightning fast.

> **Flawless Aesthetics**
> Switch between curated, bespoke themes: **Wahala** (coral/amber), **Deep Navy**, and **Forest** (supporting both dark and light modes). Built with intense glassmorphism, translucency, and micro-animations.

---

## 🛠️ Installation & Setup

Presense requires **Node.js 18+** and a **Supabase** instance.

### 1. Clone & Install
```bash
git clone https://github.com/mzaman001/Presense.git
cd Presense
npm install
```

### 2. Environment Variables
Create a `.env.local` file at the root of the project:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Database Initialization
Presense relies on a strictly typed, relational PostgreSQL database. Run the SQL migrations found in the `supabase/migrations/` folder in your Supabase SQL Editor in exact numerical order:
1. `001_schema.sql` (Base tables)
2. `002_rls.sql` (Row Level Security)
3. `003_search.sql` (Text indexing)
...through `013_pomodoro_settings.sql`

### 4. Start the Engine
```bash
npm run dev
```
Navigate to `http://localhost:3000` to begin onboarding.

---

## 🏗️ Architecture & Codebase

Presense is architected for real-time scale, utilizing an offline-capable, highly modularized structure.

* 📁 `src/app/` — Next.js App Router hierarchy separating `(app)` (authenticated spaces) and `(auth)` (login/onboarding).
* 📁 `src/components/features/` — Complex, state-driven panels (e.g., `TaskAddPanel`, `FocusSession`, `SettingsModal`).
* 📁 `src/components/layout/` — Global shell wrappers (e.g., `Navigation`, `AmbientBackground`).
* 📁 `src/components/ui/` — Stateless, reusable design system building blocks (`GlassCard`, `ContextualTip`).
* 📁 `src/hooks/useRealtime.ts` — Custom Supabase channel subscriptions powering instant UI reactivity across devices.
* 📁 `src/store/useAppStore.ts` — Zustand store for hyper-fast, prop-drilling-free UI state management.

---

<div align="center">
  <p><i>"Your mind is for having ideas, not holding them."</i></p>
  <p><b>Presense</b> © 2026. Built with purpose.</p>
</div>
