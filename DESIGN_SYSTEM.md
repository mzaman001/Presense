# Design System

## Philosophy

> *Presense feels like a warm lamp in a dark room.*

Four pillars shape every design decision:

1. **Atmosphere over flatness** — Every background has ambient light, every card has surface shimmer.
2. **Warmth at the centre** — Amber, coral, deep orange. Cool colours appear only as secondary accents.
3. **Glass as the language of depth** — Cards, panels, modals, toasts — everything is a glass surface.
4. **Inter carries the voice** — Confident where it matters, restrained where it supports.

## Colors

### Theme Tokens
- `--accent`: Primary amber (#E5B41E)
- `--accent-hot`: Coral for urgency (#EB4233)
- `--accent-deep`: Deep orange (#A76011)
- `--text-1`: Primary text
- `--text-2`: Secondary text
- `--text-3`: Tertiary text

### Space Colors
- **Do**: `#FBBF24` (amber)
- **Think**: `#2DD4BF` (teal)
- **Remember**: `#7692FF` (purple)
- **Explore**: `#A78BFA` (violet)

## Components

### GlassCard
- Two variants: `list` (no-blur) and `elevated` (with blur)
- Used for cards, panels, and containers

### Sheet
- Side panel for forms and details
- Respects `useVisualViewport` for keyboard reflow
- Includes focus trap and ARIA attributes

### Modal
- Centered dialog for important actions
- Uses `useDialogFocus` for accessibility

## Animations

### Reduced Motion
- All animations respect `prefers-reduced-motion`
- `MotionConfig` with `reducedMotion="user"`
- Particles and orbs pause when reduced motion is enabled

### Micro-interactions
- Task completion: Scale + checkmark animation
- Swipe to delete: Horizontal drag with haptic feedback
- Navigation: Subtle translateX on hover (desktop only)
