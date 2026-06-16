<div align="center">
  <img src="public/icon.svg" width="128" height="128" alt="Presense Logo" />
  <h1>Presense</h1>
  <p><strong>The beautifully designed, atmospheric productivity and capture companion.</strong></p>
</div>

---

## 🌌 Overview
Presense is a next-generation productivity application built to be your external brain. It combines task management, daily focus tracking, people/relationship tracking, and quick capturing into one beautifully designed, atmospheric workspace.

Unlike traditional utilitarian tools, Presense focuses heavily on **aesthetics, atmosphere, and micro-interactions** to create an environment you actually *want* to spend time in.

## ✨ Key Features
- **Atmospheric Design**: Built with dynamic background gradients, frosted glassmorphism overlays (`backdrop-filter`), and fluid framer-motion animations.
- **Smart Capture (Ollama/NLP)**: Quickly capture thoughts, tasks, or notes. Presense uses intelligent routing (optionally backed by local LLMs via Ollama) to automatically categorize your inputs.
- **Do (Tasks & Focus)**: A robust task manager with List and Board views, integrated Pomodoro focus timers, and automatic snoozing for overdue items.
- **Remember (People & Places)**: Keep track of important details about people in your network and locations you visit.
- **Deep Customisation**: Full theme support (Navy, Forest, Wahala), light/dark/system color modes, and extensive preferences for notifications and UI animations.
- **PWA Ready**: Installable as a Progressive Web App for a native-like experience on desktop and mobile.

## 🛠 Tech Stack
- **Framework**: Next.js 16 (App Router, Turbopack)
- **Styling**: Tailwind CSS v4 & custom vanilla CSS for complex glassmorphism/animations.
- **Animation**: Framer Motion
- **Database / Auth**: Supabase
- **Icons**: Lucide React
- **Local AI**: Ollama integration for on-device natural language processing.

## 🚀 Getting Started
1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Set up Supabase**: Provide your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
4. **Run the development server**: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🎨 Design Identity
The visual language of Presense relies on a few core principles:
- **Depth & Blur**: Extensive use of heavy backdrop blurs to create layered hierarchy.
- **Typography**: Inter for UI elements, JetBrains Mono for numbers/timers, and Playfair Display for editorial accents.
- **Subtlety**: Borders are 0.5px and highly transparent. Shadows are diffused.

## 📄 License
MIT License.
