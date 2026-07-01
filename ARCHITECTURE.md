# Architecture

## Overview

Presense is a personal productivity "second brain" built with Next.js 16, Supabase, and a bespoke glassmorphic UI.

## Tech Stack

| Layer | Technology |
|:---|:---|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS 4 |
| **Animation** | Framer Motion |
| **State** | Zustand + React Query |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime, Edge Functions) |
| **NLP** | compromise.js (local, zero API costs) |
| **UI Components** | shadcn/ui (Tabs, Tooltip, Progress) |
| **Smooth Scrolling** | Lenis |
| **Offline Support** | serwist (PWA) |

## Directory Structure

```
src/
├── app/                  # Next.js App Router
│   ├── (app)/            # Authenticated spaces
│   │   ├── do/           # Task management
│   │   ├── inbox/        # Quick capture
│   │   ├── remember/     # People & connections
│   │   ├── think/        # Threaded thoughts
│   │   └── explore/      # Reading queue
│   ├── (auth)/           # Authentication
│   ├── api/              # Route handlers
│   └── onboarding/       # First-run wizard
├── components/
│   ├── features/         # Domain components
│   ├── layout/           # App shell
│   └── ui/               # Reusable primitives
├── hooks/                # Custom React hooks
├── lib/                  # Utilities
└── store/                # Zustand state
supabase/
├── functions/            # Edge Functions
└── migrations/           # SQL migrations
```

## Key Patterns

### State Management
- **Zustand** for global state (user settings, modals, active timers)
- **React Query** for server state (tasks, threads, people, explores)
- **Optimistic updates** for instant UI feedback

### Realtime
- Supabase Realtime channels for live updates
- Echo lockout to prevent self-triggered updates
- Tab visibility handling for background updates

### Animation
- Framer Motion `m.*` components for tree-shaking
- `MotionConfig` with `reducedMotion="user"` for accessibility
- Shared layout animations for smooth transitions

### Offline
- serwist service worker for PWA capabilities
- NetworkFirst for API calls
- CacheFirst for static assets
- Offline fallback page
