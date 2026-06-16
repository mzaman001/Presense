<div align="center">
  <img src="https://via.placeholder.com/1500x500/13111C/FFFFFF?text=PRESENSE" alt="Presense Banner" width="100%" style="border-radius: 12px;" />

  <br />
  <br />

  # 🧠 Presense
  **An opinionated, deeply immersive ecosystem for your mind.**
  <br />

  [![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
  [![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Framer Motion](https://img.shields.io/badge/Framer_Motion-0055FF?style=for-the-badge&logo=framer&logoColor=white)](https://www.framer.com/motion/)

  <p align="center">
    <a href="#-the-philosophy-anti-sandbox">The Philosophy</a> • 
    <a href="#-architecture-of-thought">Architecture of Thought</a> • 
    <a href="#-engineering-immersion">Design & Immersion</a> • 
    <a href="#-installation--setup">Setup</a>
  </p>
</div>

---

## 🌌 The Philosophy: Anti-Sandbox

Apps like Notion or Obsidian give you an infinite canvas. While powerful, they inevitably turn you into a systems architect rather than an executor. You spend hours designing databases, tweaking layouts, and organizing pages instead of actually doing the work.

**Presense is the antithesis of the infinite canvas.**

It is a deeply opinionated, structural extension of your mind. It does not want you to build a system; it *is* the system. Built on principles of cognitive science, Presense enforces boundaries, automated cleanup, and psychological framing (like If-Then anchoring) to ensure your workspace remains a pristine tool for action and reflection, not a sprawling digital graveyard.

---

## 🧭 Architecture of Thought

Your mind processes different types of information differently. Presense mirrors this reality by partitioning your life into exactly four distinct, interconnected spaces:

| Space | Purpose | Cognitive Model |
|:---:|:---|:---|
| ⚡ **Do** | Action | **Implementation Intentions.** We don't do "tasks". We do "If-Then" anchors. You define exactly *where* and *when* an action happens. What matters is the starting friction, not the outcome. |
| 💭 **Think** | Reflection | **Threaded Consciousness.** Not a document, but a conversation with yourself. Long-term ideas, daily journals, and profound thoughts live in continuous, searchable threads that resurface organically. |
| 👥 **Remember** | Relationships | **Contextual Empathy.** A lightweight, personal CRM. When you meet someone, you instantly see what you talked about last time, their birthday, and any shared tasks. |
| 🧭 **Explore** | Knowledge | **Curated Consumption.** A holding zone for articles, books, and links. If it sits untouched, the automated 30-day archive cycle sweeps it away to prevent digital hoarding. |

*(All spaces roll up into the **Dashboard**, a centralized hub displaying your active focus tasks, today's meetings, and weekly Pomodoro statistics using a beautiful Bento-grid UI.)*

---

## ✨ Engineering Immersion

Productivity tools shouldn't look like spreadsheets. Presense is engineered to feel like a premium, almost physical space you want to inhabit.

> **Universal NLP Capture**  
> Hit `Cmd+K` anywhere. Type *"Meet Sarah about the design at 2pm tomorrow"*. Presense's local Natural Language Processing (`compromise`) instantly extracts the date, identifies the person, and routes the thought perfectly without you touching a dropdown menu.

> **Deep-Focus Pomodoro Integration**  
> When it's time to execute, Presense transforms. A fullscreen, immersive focus environment takes over with dynamic SVG progress rings, ambient glowing backgrounds, and configurable intervals. Distractions are hidden; only the current task exists.

> **Bespoke Glassmorphic UI**  
> Built with intense attention to visual hierarchy. Translucent layers (`backdrop-blur-3xl`), fluid `framer-motion` micro-interactions, and curated themes (like *Wahala*, *Deep Navy*, and *Forest*) ensure the app feels alive and reactive to your touch.

> **Aggressive Auto-Cleanup**  
> A workspace should be clean. Presense uses Supabase Edge Functions to enforce a strict 30-day soft-delete cycle for stale items, forcing you to engage with your data or let it go.

---

## 🛠️ Installation & Setup

Presense is a modern full-stack application requiring **Node.js 18+** and a **Supabase** instance.

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
Presense relies on a strictly typed, relational PostgreSQL database. Run the SQL migrations to set up your schema, policies, and functions:
```bash
npx supabase db push
```

### 4. Ignite
```bash
npm run dev
```
Navigate to `http://localhost:3000` to enter your new mind.

---

<div align="center">
  <p><i>"Your mind is for having ideas, not holding them."</i></p>
  <p><b>Presense</b> © 2026. Built with purpose.</p>
</div>
