# Presense — Your External Brain

![Presense Banner](https://via.placeholder.com/1200x600/13111C/FFFFFF?text=Presense)

**Presense** is a premium, personal productivity web application designed to act as an external brain. It goes beyond simple task management to capture thoughts, people, and resources, intelligently resurfacing them exactly when you need them.

Built with **Next.js 16**, **Supabase**, **Tailwind CSS**, and **Framer Motion**, Presense focuses on a stunning, dynamic aesthetic with glassmorphism, micro-animations, and high-performance offline-first data structures.

---

## 🧠 Core Philosophy

Traditional productivity apps suffer from extreme siloing. Tasks live in one app, notes in another, and contacts in a CRM you never check. 

Presense breaks this by combining five distinct spaces into a unified ecosystem, connected by an intelligent, NLP-driven capture router.

### The Five Spaces
1. **Do (Action)**: Tasks that move. Focus on the smallest physical step to start, not just finishing. Features a configurable Pomodoro timer and "Start Date" filtering to prevent board overwhelm.
2. **Think (Reflection)**: Thoughts that stay. Threaded, continuous journaling that auto-generates daily notes and pins active threads.
3. **Remember (People & Locations)**: A personal CRM. Log what people tell you, their preferences, and when you'll next see them. Includes a "Locations" tracker so you never lose your passport or keys again.
4. **Explore (Resources)**: Things worth keeping. Save links, books, and concepts. Linked directly to Think threads for deeper context.
5. **Dashboard (The Hub)**: A central hub displaying active focus tasks, today's meetings, pinned threads, and weekly Pomodoro statistics.

---

## ✨ Key Features

* **Universal NLP Capture**: Type "Meeting with Max next Tuesday at 2pm" — the system automatically extracts the date, creates the task, and routes it.
* **If-Then Anchoring**: Define the exact physical location and time you will start a task (e.g., "When I sit at my desk after dinner, I will open Chapter 3").
* **Focus Mode**: A deeply immersive, fullscreen Pomodoro timer with SVG progress rings and ambient glowing backgrounds.
* **Cross-Space Linking**: Link captured Explore articles directly to active Think threads.
* **Local-First Speed**: Built entirely on `useRealtime` hooks with Supabase for instant UI updates and seamless multi-device sync.
* **Archive Ecosystem**: A 30-day soft-delete cycle with nightly Edge Functions for permanent cleanup, keeping the active database fast and clean.
* **Premium Theming**: Switch between "Wahala" (coral/amber), "Deep Navy", and "Forest" themes, complete with dark/light mode support.

---

## 🚀 Tech Stack

* **Frontend**: Next.js 16 (App Router), React, TypeScript
* **Styling**: Tailwind CSS, Vanilla CSS (`index.css`), Framer Motion, `clsx` + `tailwind-merge`
* **Database & Auth**: Supabase (PostgreSQL, Row Level Security, Realtime Subscriptions)
* **NLP**: Compromise & Compromise-Dates
* **Icons**: Lucide React
* **Typography**: Inter & JetBrains Mono (Google Fonts)

---

## 🛠️ Setup & Installation

### 1. Clone the repository
```bash
git clone https://github.com/mzaman001/Presense.git
cd Presense
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Setup the Database
Run the SQL migrations found in the `supabase/migrations/` folder in your Supabase SQL Editor in order:
* `001_schema.sql`
* `002_rls.sql`
* `003_search.sql`
* ...through `013_pomodoro_settings.sql`

### 5. Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🏗️ Architecture Overview

The codebase is heavily modularized for scale:
* `src/app/`: Next.js App Router structure with `(app)` for authenticated spaces and `(auth)` for login/onboarding.
* `src/components/features/`: Complex, stateful UI components (e.g., `TaskAddPanel`, `FocusSession`, `CaptureModal`).
* `src/components/layout/`: Shell components (e.g., `Navigation`, `Topbar`, `AmbientBackground`).
* `src/components/ui/`: Reusable, stateless design system components (e.g., `GlassCard`, `ContextualTip`).
* `src/hooks/`: Custom React hooks, notably `useRealtime` for Supabase channels.
* `src/store/`: Zustand global state management (`useAppStore.ts`).
* `src/lib/`: Utilities, including the `capture-router.ts` rule-based NLP engine.

---

## 🎨 Design System

Presense uses a bespoke design system focusing on depth, translucency, and motion. 
* **Glass Cards**: Built using heavy backdrop blurs, low-opacity white/black backgrounds, and subtle gradient borders.
* **Micro-animations**: Extensive use of Framer Motion for slide-in panels, tab transitions, and list stagger effects.
* **Colors**: Defined in `globals.css` as CSS variables to allow seamless, instant theme switching via JavaScript before React hydration.

---

## 📝 License

This project is private and proprietary. All rights reserved.
