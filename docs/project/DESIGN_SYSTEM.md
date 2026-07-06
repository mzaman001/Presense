# DESIGN_SYSTEM.md — Presense

> **The authoritative visual specification.** Every component, every token, every state, every breakpoint. If a pattern isn't here, don't invent it — ask for it to be added.
>
> **Researched from:** shadcn/ui (Feb 2025 Tailwind v4 update), Radix UI / Base UI primitives, Vaul (drawer patterns), cmdk (command palette), Apple Human Interface Guidelines, Material 3, WCAG 2.2 (W3C), NN/g bottom sheet guidelines, web.dev (content-visibility, Core Web Vitals), Framer Motion / Motion docs, Tailwind CSS v4 docs, and productivity app design analysis of Things3 (Cultured Code), Sunsama, Todoist, Superlist, Notion, Obsidian, Cron/Notion Calendar, Fantastical, Apple Reminders.

---

## 1. Design Philosophy (Non-Negotiable)

**Presense feels like a warm lamp in a dark room.** Four pillars, never compromised:

1. **Atmosphere over flatness** — ambient orbs, surface shimmer, grain texture. Never a blank canvas.
2. **Warmth at the centre** — amber, coral, deep orange. Cool colours are secondary accents only.
3. **Glass as depth** — cards, panels, modals are glass surfaces floating in atmosphere.
4. **Inter carries the voice** — all type is Inter. JetBrains Mono for numbers only.

**Design inspiration (studied for patterns, not copied):**
- **Things3** — calm restraint, circular check-off animation, quiet typography, sidebar hierarchy
- **Sunsama** — daily ritual flow, time-blocking, warm neutral palette, minimized cognitive load
- **Superlist** — playful micro-interactions, bouncy springs, satisfying check-off, pastel accents
- **Todoist** — natural language input, sticky group headers, board/list/calendar views, karma streaks
- **Notion** — block-based editing, clean command palette, minimal chrome
- **Linear** — keyboard-first, speed, dense-but-readable, dark-mode craft
- **Apple Reminders** — mobile-first simplicity, natural language, smart lists

---

## 2. Theme System

### Themes (3 total, using `data-theme` attribute on `<html>`)

| Internal ID | CSS selector | Display name | Vibe |
|---|---|---|---|
| `warm` | `:root` (default, no attribute needed) | Warm | Amber/coral on near-black. The default. |
| `navy` | `:root[data-theme="navy"]` | Navy | Deep blue. |
| `forest` | `:root[data-theme="forest"]` | Forest | Deep green. |

### Modes (2 total, using `data-mode` attribute on `<html>`)

| Mode | CSS selector | Description |
|---|---|---|
| `dark` | `:root` (default) | Dark background, light text |
| `light` | `:root[data-mode="light"]` | Light background, dark text |

### Default

- Theme: `warm`
- Mode: `dark`
- On login page (unauthenticated): always `warm` + `dark`, regardless of localStorage

### Legacy name mapping (handled by `src/lib/theme.ts`)

```
orange, wahala, sunset → warm
blue, midnight, navy → navy
forest, meadow → forest
```

**NEVER use legacy names in new code.** Use `warm` / `navy` / `forest` only.

### Space identity colors (now distinct per space)

| Space | Token (dark) | Token (light) | Hue family |
|---|---|---|---|
| Do | `--space-do: #E5B41E` | `#C8900A` | Amber |
| Think | `--space-think: #EB4233` | `#D43520` | Coral red |
| Remember | `--space-remember: #F4A261` | `#D97706` | Peach |
| Explore | `--space-explore: #A76011` | `#8A4E08` | Deep amber |

All four are in the warm family (per Pillar 2). Each space has a distinct hue so sidebar icons, page headers, and badges can be color-coded without breaking the warm aesthetic.

---

## 3. Color Tokens

### Rule: NEVER hardcode hex in JSX

**Use `var(--token)` always.** There are currently 87 hardcoded hex colors in JSX — these are debt, being fixed via `DS-02` in the backlog. New code must not add more.

### Core tokens (defined in `globals.css`)

| Token | Purpose | Warm (dark) |
|---|---|---|
| `--bg-base` | Page background | `#0F0A00` |
| `--bg-elevated` | Elevated background | `#1A1000` |
| `--accent` | Primary accent | `#E5B41E` |
| `--accent-hot` | Hot accent (coral) | `#EB4233` |
| `--accent-deep` | Deep accent | `#A76011` |
| `--text-1` | Primary text | `#FFFFFF` |
| `--text-2` | Secondary text | `rgba(255,255,255,0.72)` |
| `--text-3` | Tertiary text | `rgba(255,255,255,0.60)` |
| `--text-4` | Quaternary / decorative | `rgba(255,255,255,0.55)` |
| `--surface-1` | Surface level 1 | `rgba(255,255,255,0.055)` |
| `--surface-2` | Surface level 2 | `rgba(255,255,255,0.085)` |
| `--border-default` | Default border | `rgba(255,255,255,0.10)` |
| `--border-strong` | Strong border | `rgba(255,255,255,0.18)` |

### Status colors

| Status | Token | Value |
|---|---|---|
| Overdue | `--status-overdue` | `#F87171` |
| Today | `--status-today` | `#F59E0B` |
| Upcoming | `--status-upcoming` | `#2DD4BF` |
| Done | `--status-done` | `#4ADE80` |
| Danger | `--status-danger` | `#F87171` |

### Glass recipe

| Property | Value |
|---|---|
| Blur (standard) | `blur(20px)` |
| Blur (heavy) | `blur(24px)` (reduced from 32px per audit) |
| Border | `0.5px solid var(--border-card)` |
| Top highlight | `1px var(--border-card-top)` |
| Shadow (card) | `0 4px 24px rgba(0,0,0,0.35)` |
| Shadow (card hover) | `0 8px 32px rgba(0,0,0,0.45)` |
| Shadow (modal) | `0 24px 64px rgba(0,0,0,0.60)` |

**WORKING GLASSMORPHISM RULE (do not change):**
- **Backdrop overlay:** `bg-black/60` ONLY. NO `backdrop-filter`. NO blur class. NO Tailwind `backdrop-blur-*`.
- **Modal panel:** inline `style={{ backdropFilter: 'blur(48px)', WebkitBackdropFilter: 'blur(48px)' }}` on the panel element itself.
- This is NOT negotiable. CSS classes alone do not work due to compositing context issues. The inline style is the ONLY approach that works.
- `--surface-modal` opacity must be 0.50 (50%) so the blur is visible.

---

## 4. Typography

### Font families

| Token | Font | Usage |
|---|---|---|
| `--font-sans` | Inter | All body text, headings, UI |
| `--font-mono` | JetBrains Mono | Numbers, timestamps, code, keyboard hints |

### Type scale (use semantic classes, NEVER arbitrary `text-[13px]`)

| Class | Size | Weight | Line height | Usage |
|---|---|---|---|---|
| `text-display` | 48px | 700 | 1.2 | Hero text (rare) |
| `text-page-greeting` | 26px | 500 | 1.2 | Page greetings |
| `text-page-title` | 22px | 500 | 1.2 | Page titles |
| `text-section-title` | 18px | 600 | 1.35 | Section headers |
| `text-card-title` | 14px | 600 | 1.35 | Card titles |
| `text-body` | 13px | 400 | 1.6 | Body text |
| `text-body-small` | 12px | 400 | 1.5 | Secondary body |
| `text-label` | 10px | 600 | 1.0 | Uppercase labels (tracking: 0.1em) |
| `text-mono` | 14px | 400 | — | Numbers, timestamps |

### Fluid typography (progressive enhancement)

For new responsive text, use `clamp()` for fluid scaling:
```css
font-size: clamp(13px, 0.25vw + 12.5px, 15px);
```

### Mobile input zoom prevention (iOS Safari)

**All inputs on mobile MUST be at least 16px font-size** or iOS Safari auto-zooms on focus:
```css
@media (max-width: 767px) {
  input, textarea, select { font-size: max(16px, var(--text-md)); }
}
```
(This is already in `globals.css` — do not remove it.)

---

## 5. Spacing & Layout

### Spacing scale (Tailwind default)

| Token | Value | Usage |
|---|---|---|
| `gap-1` / `p-1` | 4px | Tight gaps (icon + label) |
| `gap-2` / `p-2` | 8px | Default gap |
| `gap-3` / `p-3` | 12px | Section gaps |
| `gap-4` / `p-4` | 16px | Card padding (standard) |
| `gap-6` / `p-6` | 24px | Large card padding |
| `gap-8` | 32px | Major section breaks |

### Radius scale

| Token | Value | Usage |
|---|---|---|
| `--radius-xs` | 4px | Small elements (badges, chips) |
| `--radius-sm` | 8px | Inputs, small buttons |
| `--radius-md` | 12px | Dropdowns, medium buttons |
| `--radius-lg` | 16px | Cards, panels |
| `--radius-xl` | 20px | Modals, large surfaces |
| `--radius-2xl` | 24px | Sheets (mobile) |
| `--radius-full` | 9999px | Pills, circles |

### Breakpoints (Tailwind default, mobile-first)

| Prefix | Min width | Target | Layout |
|---|---|---|---|
| (none) | 0px | Mobile portrait | Bottom nav, single column, sheets |
| `sm:` | 640px | Mobile landscape / small tablet | Bottom nav, single column |
| `md:` | 768px | Tablet | Sidebar appears (hover rail), bottom nav hidden |
| `lg:` | 1024px | Desktop | Sidebar, multi-column, full features |
| `xl:` | 1280px | Large desktop | Max content width cap |
| `2xl:` | 1536px | Extra large | Max content width cap |

### Content width

- Max content width: `max-w-5xl` (1024px) for most pages
- Max content width for detail pages: `max-w-2xl` (672px)
- Sidebar width: 80px collapsed, 248px expanded

### Viewport height

**Use `100dvh` (dynamic viewport height), NEVER `100vh`.** iOS Safari's `100vh` includes the URL bar, causing content to be clipped. `100dvh` adjusts dynamically.

```css
/* Correct */
height: 100dvh;
min-height: 100dvh;

/* Wrong — clips on iOS Safari */
height: 100vh;
```

### Safe area insets

`viewport-fit: cover` is set in the viewport meta. Use these for notch / home indicator:

```css
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
```

The bottom nav uses `pb-safe` class. The MobileTopBar uses inline `style={{ paddingTop: 'env(safe-area-inset-top)' }}`.

---

## 6. Component Patterns (THE CANONICAL LIST)

> **When creating a new UI element, use these patterns. If a pattern isn't listed here, STOP and ask.**

### Button

```tsx
import { Button } from "@/components/ui/button";

<Button variant="primary" size="md">Save</Button>
<Button variant="secondary" size="sm">Cancel</Button>
<Button variant="ghost" size="icon"><Plus size={20} strokeWidth={1.5} /></Button>
<Button variant="destructive" size="md">Delete</Button>
```

**Variants:** `primary` | `secondary` | `ghost` | `destructive` | `outline` | `link`
**Sizes:** `xs` | `sm` | `md` | `lg` | `icon` (44×44px) | `icon-sm` | `icon-lg`

### UiIcon

```tsx
import { Icon as UiIcon } from "@/components/ui/Icon";
import { Plus } from "lucide-react";

<UiIcon icon={Plus} size={20} />
<UiIcon icon={Plus} size={20} variant="solid" />
```

**Usage:** Always use `UiIcon` when you need an icon from `lucide-react`. Do not import and render the icon directly. `UiIcon` enforces `strokeWidth={1.5}` for default, and `strokeWidth={2}` for the `solid` variant (intended for filled circular buttons and primary CTAs).

**Rules:**
- NEVER use raw `<button>` with custom classes in feature components
- NEVER use `.btn-primary`, `.btn-secondary` etc. (deleted)
- Icon-only buttons MUST be `size="icon"` (44×44px minimum per WCAG 2.5.5)
- `strokeWidth={1.5}` for icons inside buttons, `strokeWidth={2}` only inside filled circular buttons

### Input

```tsx
import { Input } from "@/components/ui/Input";

<Input
  label="Title"
  value={title}
  onChange={(e) => setTitle(e.target.value)}
  placeholder="Enter title..."
  error={errors.title?.message}
  inputMode="text"        // always set inputMode
  autoComplete="off"      // set appropriately
  autoCapitalize="sentences"
/>
```

**Rules:**
- NEVER use raw `<input>` in feature components. Use `<Input>`.
- ALWAYS set `inputMode` (`text` | `email` | `search` | `tel` | `numeric`)
- ALWAYS set `autoComplete` (`off` | `email` | `name` | `current-password`)
- ALWAYS set `autoCapitalize` (`sentences` | `words` | `none`)
- Font-size is 16px on mobile (prevents iOS zoom — handled by CSS)

### Textarea

```tsx
import { Textarea } from "@/components/ui/Textarea";

<Textarea
  label="Notes"
  value={notes}
  onChange={(e) => setNotes(e.target.value)}
  minRows={3}
  placeholder="Enter notes..."
/>
```

**Rules:**
- NEVER use raw `<textarea>` or `TextareaAutosize` directly. Use `<Textarea>`.
- `<Textarea>` wraps `TextareaAutosize` internally + adds `field-sizing: content` as progressive enhancement

### SearchInput

```tsx
import { SearchInput } from "@/components/ui/SearchInput";

<SearchInput
  value={query}
  onChange={setQuery}
  placeholder="Search threads..."
/>
```

**Rules:**
- Use for every search box in the app
- Has built-in search icon, clear button, and `inputMode="search"`

### GlassCard (Surface)

```tsx
import { GlassCard } from "@/components/ui/GlassCard";

<GlassCard variant="list" className="p-4">
  Content here
</GlassCard>
```

**Variants:**
- `list` — no blur, for list items (TaskCard, ExploreItem, thread rows). Uses `.glass-card` class.
- `elevated` — blur(24px), for modals, sidebar, hero. Uses `.glass-card-elevated` class.

**Rules:**
- NEVER use raw `glass-card` or `glass-panel` CSS classes in JSX. Use `<GlassCard>`.
- Default padding is `p-6` — override with `className="p-4"` for tighter

### Dropdown

```tsx
import { Dropdown } from "@/components/ui/Dropdown";

<Dropdown
  value={selected}
  onChange={setSelected}
  options={[{ value: "a", label: "A" }, { value: "b", label: "B" }]}
  variant="select"  // or "chip" for compact pill trigger
/>
```

**Rules:**
- NEVER use native `<select>`. Always use `<Dropdown>`.
- NEVER use `<datalist>`. Always use `<Dropdown>` or a combobox pattern.
- Uses `createPortal` — renders to `document.body`, cannot be clipped by `overflow: hidden`
- Do NOT replace portal with z-index fix (invariant #3)

### Sheet (mobile modal / bottom sheet)

```tsx
import { Sheet } from "@/components/ui/Sheet";

<Sheet isOpen={open} onClose={onClose} title="Edit Task">
  Content here
</Sheet>
```

**What Sheet handles:**
- Drag-to-dismiss (swipe down >100px or velocity >500px/s)
- Focus trapping (`useDialogFocus`)
- Body scroll lock (`useBodyScrollLock` — ref-counted, Lenis-aware)
- Keyboard avoidance (`useVisualViewport` — sheet slides above soft keyboard)
- Backdrop tap to dismiss
- Escape key to dismiss
- Mobile: bottom sheet (rounded top, drag handle)
- Desktop: centered modal (rounded all sides)

**Rules:**
- NEVER build a custom modal. Use `<Sheet>` or `<ConfirmModal>`.
- On mobile, sheets are bottom-anchored (per NN/g bottom sheet guidelines)
- Drag handle is 48×4px, centered, semi-transparent

### ConfirmModal

```tsx
import { ConfirmModal } from "@/components/ui/ConfirmModal";

<ConfirmModal
  isOpen={deleteOpen}
  onClose={() => setDeleteOpen(false)}
  onConfirm={handleDelete}
  title="Delete this item?"
  description="This cannot be undone."
  confirmLabel="Delete"
  confirmDestructive
  inputRequired="task name"  // optional: require typed confirmation
/>
```

**Rules:**
- NEVER use `window.confirm()`, `window.alert()`, or `window.prompt()`. Always use `<ConfirmModal>`.
- For destructive actions (delete person, delete account), use `inputRequired` to require typed confirmation

### EmptyState

```tsx
import { EmptyState } from "@/components/ui/EmptyState";

<EmptyState
  icon={Wind}
  title="You're all caught up"
  description="No tasks due today. Take a well-deserved break."
  action={{ label: "Add Task", onClick: () => setIsPanelOpen(true) }}
/>
```

**Rules:**
- NEVER use bare "Nothing here" text. Use `<EmptyState>`.
- The `action.onClick` must open the SAME panel as that space's header "Add" button (not Quick Capture, except in Inbox where Quick Capture IS correct)
- Every empty state must have: icon + title + description + action

### PageHeader

```tsx
import { PageHeader } from "@/components/ui/PageHeader";

<PageHeader
  title="Do"
  actions={<Button variant="secondary"><Plus size={16} /> Add task</Button>}
/>
```

**Rules:**
- Every space page starts with `<PageHeader>`
- Contains the space name, optional action buttons, optional view toggle

### Icons (Lucide)

```tsx
import { Plus, Check, Search } from "lucide-react";

<Plus size={20} strokeWidth={1.5} />
```

**Rules:**
- `strokeWidth={1.5}` for ALL UI icons (55 usages currently — correct)
- `strokeWidth={2}` ONLY inside filled circular buttons (capture button, primary CTAs)
- NEVER use `strokeWidth={0}`, `{3}`, `{1.8}`, `{2.5}`, `{1.7}` (inconsistency debt — being fixed via DS-06)
- Size: 20px for sidebar/nav, 16px for inline/card, 14px for compact UI

### Avatar

```tsx
import { Avatar } from "@/components/ui/Avatar";

<Avatar name="John Doe" color="#E5B41E" size="sm" />
```

**Sizes:** `sm` (32px) | `md` (40px) | `lg` (56px)
**Rules:** Always provide a fallback (initials). Never render empty.

### Badge

```tsx
import { Badge } from "@/components/ui/Badge";

<Badge style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}44` }}>
  3
</Badge>
```

### Skeleton (loading state)

```tsx
import { PageSkeleton } from "@/components/ui/Skeleton";

{loading ? <PageSkeleton count={5} type="task" /> : <TaskList />}
```

**Rules:**
- NEVER use a bare spinner for page-level loading. Use `<Skeleton>` / `<PageSkeleton>`.
- Shimmer animation is built into the `.skeleton-shimmer` CSS class

### Toast (sonner)

```tsx
import { toast } from "sonner";

toast.success("Task completed");
toast.error("Failed to save", { description: error.message });
toast.success("Task archived", {
  action: { label: "Undo", onClick: restoreTask },
  duration: 5000,
});
```

**Rules:**
- EVERY Supabase mutation must show a toast on success AND error
- Undo toasts use `duration: 5000` (5 seconds, with drain animation)
- NEVER stack more than 3 toasts

---

## 7. Motion System

### Principles (from Disney 12 + Motion docs)

1. **Never block** — optimistic UI + rollback. Never show a spinner for a mutation that should be instant.
2. **Slow in / slow out** — never use `linear` easing for organic motion. Use springs or cubic-beziers.
3. **Reduced motion is not no motion** — it's no distance and no easing. Opacity crossfades still communicate change. Remove `transform` distance, not just `transition-duration`.
4. **Don't animate colors** — expensive. Animate `opacity` or `background-blend` instead.
5. **Don't use bouncy springs on destructive actions** — a delete should feel decisive, not playful.

### Motion tokens

| Token | Duration | Easing | Usage |
|---|---|---|---|
| `--dur-instant` | 80ms | linear | Micro-interactions (button press) |
| `--dur-fast` | 140ms | ease-out | Exit transitions, dropdown close |
| `--dur-base` | 220ms | cubic-bezier(0.25, 0.46, 0.45, 0.94) | Standard transitions, page enter |
| `--dur-slow` | 300ms | cubic-bezier(0.25, 0.46, 0.45, 0.94) | Sheet open, modal enter |
| `--dur-hero` | 480ms | ease-out | Hero animations (rare) |

### Spring presets

| Preset | Stiffness | Damping | Usage |
|---|---|---|---|
| Sheet mobile | 320 | 30 | Sheet enter/exit (per audit recommendation) |
| Card hover | 400 | 25 | FAB tap, card press |
| Swipe snap | 500 | 40 | TaskCard swipe snap-back |
| Tooltip | 300 | 28 | Dropdown enter |

### Per-element motion catalogue

| Element | Enter | Exit | Notes |
|---|---|---|---|
| Page transition | `opacity: 0→1, 220ms` | `opacity: 1→0, 140ms` | NO y-axis movement (prevents layout shift) |
| Modal/Sheet (mobile) | `y: 100%→0, spring(320,30)` | `y: 0→100%, 200ms` | Bottom-anchored |
| Modal/Sheet (desktop) | `opacity+scale: 0.97→1, spring(300,28)` | `opacity+scale: 1→0.97, 140ms` | Centered |
| Dropdown | `opacity+scaleY: 0.96→1, 140ms` | `opacity+scaleY: 1→0.96, 100ms` | Transform origin: top |
| Toast | `opacity+y: 8→0, spring(300,28)` | `opacity+y: 0→16, 140ms` | |
| Task complete | `scale: [1, 1.2, 1] + checkmark draw, 240ms` | `opacity+scale: 1→0.95, 300ms` | Check-draw CSS keyframe |
| New item | `opacity+y: -12→0+scale: 0.97→1, 220ms` | `opacity+x: -20+blur, 300ms` | Highlight glow for 400ms |

### Rules

- Use `m.*` not `motion.*` (LazyMotion strict mode)
- All motion must be inside `<MotionProvider>`
- Wrap hover transforms in `@media (hover: hover) and (pointer: fine)` — disable on touch
- Honor `prefers-reduced-motion: reduce` — remove distance, not just duration
- Honor `prefers-reduced-transparency: reduce` — disable blur, use opaque fallbacks

### Check-off animation (Things3 signature)

The highest-impact beauty win. CSS keyframe `check-draw` already exists in `globals.css`. When `isCompleting` becomes true:
1. Checkbox fills with `var(--space-do)` (240ms)
2. Checkmark SVG stroke draws in (240ms, via `stroke-dasharray` animation)
3. Task title gets strike-through (200ms, starting at 100ms)
4. Card scales to 0.97 + fades to 0.6 opacity (300ms, starting at 200ms)
5. Card slides out left + collapses (300ms, starting at 400ms)

---

## 8. Mobile-Specific Patterns

### Bottom navigation (mobile only)

5 items: Home, Do, Capture (center FAB), Think, Explore.
- `md:hidden` — only shows on mobile
- `min-h-[56px]` per item, `min-w-[44px]` (WCAG 2.5.5)
- `backdrop-blur-md` (12px, NOT `2xl` — performance on Android)
- `pb-safe` for safe area inset
- Center capture button: 48px circle, elevated `-mt-6`, accent gradient

### Sidebar (desktop only)

- `hidden md:flex` — hidden on mobile
- Collapsed: `w-[80px]` (icon rail)
- Expanded: `hover:w-[248px]` / `focus-within:w-[248px]`
- Labels: `opacity-0 max-w-0` by default, animate to `opacity-100 max-w-[160px]` on hover
- `transition-[width] duration-200` (acceptable — only fires on mouseenter/leave)
- Profile row at bottom: Avatar + name + email, 60px tall

### Sheet on mobile (per NN/g bottom sheet guidelines)

- Bottom-anchored, `rounded-t-[24px]`
- Drag handle: 48×4px, centered, `bg-[var(--border-strong)] opacity-50`
- Max height: `90vh` (use `90dvh` actually)
- Swipe down to dismiss: threshold 100px OR velocity 500px/s
- Keyboard avoidance: `useVisualViewport` adjusts `paddingBottom`
- `overscroll-behavior: contain` on sheet body (prevents scroll chaining)

### Touch targets (WCAG 2.2 §2.5.8 + §2.5.5)

- **Minimum:** 24×24px (WCAG 2.5.8 Level AA)
- **Recommended:** 44×44px (WCAG 2.5.5 Level AAA, Apple HIG)
- All icon-only buttons: `size="icon"` = 44×44px
- Bottom nav items: `min-h-[56px] min-w-[44px]`
- TaskCard action buttons: wrap in 44×44px transparent hit area

### Swipe gestures (per Things3/Superlist patterns)

| Action | Threshold | Velocity | Notes |
|---|---|---|---|
| Complete task | 60px left | OR 400px/s | Easier than delete |
| Delete task | 100px left | AND 500px/s | Harder — requires intent |
| Dismiss sheet | 100px down | OR 500px/s | |

### Haptics (per Apple HIG)

```tsx
import { useHaptics } from "@/hooks/useHaptics";
const haptics = useHaptics();

haptics.light();      // task complete, FAB tap
haptics.selection();  // mention select
haptics.medium();     // task delete
haptics.success();    // ritual complete
haptics.error();      // save failed
```

- Keep under 30ms — anything longer feels like an error
- Disable when `prefers-reduced-motion: reduce`
- iOS doesn't support `navigator.vibrate` — use Web Audio API tick as fallback (future)

### Input keyboard types (per Apple HIG + Android best practices)

| Input type | `inputMode` | `autoComplete` | `autoCapitalize` |
|---|---|---|---|
| Capture (general) | `text` | `off` | `sentences` |
| Search | `search` | `off` | `none` |
| Email | `email` | `email` | `none` |
| Person name | `text` | `name` | `words` |
| Task title | `text` | `off` | `sentences` |
| Thread/note | `text` | `off` | `sentences` |

---

## 9. Accessibility (WCAG 2.2 AA)

### Color contrast

| Element | Minimum ratio | Standard |
|---|---|---|
| Body text | 4.5:1 | WCAG 2.1 §1.4.3 (Level AA) |
| Large text (18px+) | 3:1 | WCAG 2.1 §1.4.3 |
| UI components / borders | 3:1 | WCAG 2.2 §1.4.11 |
| Non-text contrast | 3:1 | WCAG 2.2 §1.4.11 |

`--text-4` is at 55% alpha (bumped from 35%). Verify on all surfaces.

### Touch targets

- WCAG 2.5.8 (Level AA): 24×24px minimum
- WCAG 2.5.5 (Level AAA): 44×44px minimum
- Presense targets AAA (44px) for all icon-only buttons

### Focus management

- Every modal uses `useDialogFocus` (focus trap + restore on close)
- `:focus-visible` ring: `2px solid var(--accent)`, `2px offset`
- Skip-to-main-content link (backlog item A11Y-03)
- `aria-label` on ALL icon-only buttons (backlog item A11Y-01)

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  /* Remove DISTANCE, not just duration */
  .glass-card:hover { transform: none; }  /* not just duration: 0 */
}

@media (prefers-reduced-transparency: reduce) {
  .glass-card { backdrop-filter: none; background: var(--bg-elevated); }
  .orb { display: none; }
}
```

### Screen reader announces

- `aria-live="polite"` region for realtime updates (backlog item A11Y-02)
- Toast announcements via sonner's built-in `role="status"`
- Form errors wired to `aria-invalid` + `aria-describedby` (backlog item A11Y-05)

---

## 10. Performance Patterns

### content-visibility (per web.dev)

```css
/* In globals.css — already declared but needs JSX wiring */
.task-card-wrapper,
.explore-item-wrapper {
  content-visibility: auto;
  contain-intrinsic-size: 0 88px;
}
```

**Must add** `className="task-card-wrapper"` to the motion.div wrapping each TaskCard. Currently the CSS rule is inert (0 usages). This is DS-12 in the backlog.

### Blur budget (per Chrome DevTools guidance)

- Maximum 2 stacked `backdrop-filter` surfaces at any time
- Bottom nav: `backdrop-blur-md` (12px) — NOT `2xl`
- MobileTopBar: `backdrop-blur-md` (12px) — NOT `2xl`
- Modals: `backdrop-blur-sm` (8px) on backdrop, `backdrop-blur-heavy` (24px) on modal body
- Cards: no blur on `variant="list"`, blur on `variant="elevated"` only

### Dynamic imports (per Next.js docs)

- `compromise` (~140KB) and `chrono-node` (~50KB) must be dynamically imported, not statically imported in client components
- Heavy modals (PomodoroTimer, RitualOverlay, SettingsModal) are already lazy-loaded via `next/dynamic` — do not change

### Image optimization

- `next/image` with `formats: ['image/avif', 'image/webp']` (already in next.config)
- Avatar uses `unoptimized` (small, not worth optimizing) — acceptable
- `loading="lazy"` on below-fold images
- `fetchpriority="high"` on LCP image (if any)

---

## 11. Known Inconsistencies (Debt — Being Fixed)

These are known violations that exist in the codebase:

| # | Issue | Count | Backlog ticket |
|---|---|---|---|
| 1 | Hardcoded hex colors in JSX (should be `var(--token)`) | 87 | DS-02 |
| 2 | Raw `<input>` elements (should be `<Input>`) | 10 | DS-03 |
| 3 | `TextareaAutosize` imports (should be `<Textarea>`) | 10 | DS-04 |
| 4 | `<SearchInput>` component exists but unused | 0 usages | DS-05 |
| 5 | `<Textarea>` component exists but unused | 0 usages | DS-04 |
| 6 | Icon strokeWidth inconsistency (9 different values) | 9 | DS-06 |
| 7 | `: any` annotations (should be typed) | 75 | TOOL-01 |
| 8 | `content-visibility` CSS declared but not wired to JSX | 0 usages | DS-12 |
| 9 | `template.tsx` missing (page transitions inconsistent) | — | T0-11 |
| 10 | CI YAML has typo (`branches: ain, master]`) | — | T0-14 |

---

## 12. Adding New Components

If you need a UI element that doesn't exist in this document:

1. **STOP.** Do not invent a new pattern.
2. Check `docs/project/COMPONENT_MANIFEST.md` — does an existing component fit?
3. If nothing fits, add a ticket to `EXECUTION_SPEC.md` requesting the new primitive.
4. The human will add the pattern to this document AND the manifest.
5. Then you can build it.

**This is how we prevent the "every component looks different" problem.** No new visual patterns without being documented here first. Every time an agent has skipped this step, the app has gotten more inconsistent.

---

## Research Sources

This design system was informed by:

**Official documentation:**
- shadcn/ui (Feb 2025 Tailwind v4 update — `data-slot` attributes, React 19, no forwardRef)
- Radix UI / Base UI (headless primitive patterns, accessibility)
- Tailwind CSS v4 (Lightning CSS, `@theme`, `data-*` variant support)
- Framer Motion / Motion (LazyMotion, `m.*` components, spring physics)
- Next.js 16 (App Router, `next/dynamic`, `next/image`, metadata API)
- WCAG 2.2 (W3C — §1.4.3 contrast, §1.4.11 non-text contrast, §2.5.5 target size, §2.5.8 target size minimum)
- MDN (`content-visibility`, `100dvh`, `env(safe-area-inset-*)`, `overscroll-behavior`)
- web.dev (content-visibility, Core Web Vitals, INP)
- Apple Human Interface Guidelines (touch targets, haptics, keyboard types)
- Material 3 (color system, elevation, motion)

**Productivity app analysis:**
- Things3 (Cultured Code) — calm restraint, check-off animation, sidebar hierarchy, typography
- Sunsama — daily ritual flow, time-blocking, warm palette, cognitive load minimization
- Superlist — bouncy springs, satisfying check-off, pastel accents, micro-interactions
- Todoist — natural language input, sticky group headers, board/list/calendar views
- Notion — block editing, command palette, minimal chrome
- Linear — keyboard-first, dark-mode craft, dense-but-readable
- Cron / Notion Calendar — keyboard navigation, clean week view
- Fantastical — natural language, mobile-first

**Community & patterns:**
- Vaul (Emil Kowalski) — drawer pattern, drag-to-dismiss, snap points
- cmdk (Vercel) — command palette, fuzzy search, keyboard nav
- Sonner (Emil Kowalski) — toast patterns, undo, drain animation
- NN/g (Nielsen Norman Group) — bottom sheet UX guidelines
- LogRocket — bottom sheet design best practices
- Theo (t3.gg) — `@t3-oss/env-nextjs`, T3 stack conventions
- Fireship — rapid-fire dev education, modern patterns
- Josh Comeau — CSS education, spacing, shadows
- Kevin Powell — responsive design, fluid typography
- Una Kravets / Adam Argyle (nerdy.dev) — CSS custom properties, `@property`, color-mix
- Reddit r/webdev, r/reactjs, r/FigmaDesign — community patterns, pain points


## 9. Canonical Interaction Patterns

To prevent fragmentation, all interactions must follow these single, approved patterns. Do not introduce alternatives.

### 9.1 Object Creation Entry Points
- **Pattern:** Creation always happens via a dedicated Side Panel or Sheet (e.g., TaskAddPanel.tsx), never inline content-editable text blocks.
- **Trigger:** Initiated by a top-level Header action button or an Empty State action button (Empty states must always provide an action matching the header).
- **Focus:** The primary input (e.g., 	itle) **must immediately receive autofocus** upon the panel opening (via utoFocus prop + bypassing any delayed focus-lock hijacking).

### 9.2 Inline vs. Sheet Editing
- **Pattern:** Editing an existing object uses the exact same Side Panel or Sheet as creation, populated with the object's existing data.
- **Rule:** No inline field editing (e.g., clicking a text element to turn it into an input). Click the card/row -> opens the edit panel.

### 9.3 Delete / Undo / Confirm
- **Pattern:** Soft-delete with Toast-based Undo.
- **Rule:** Never show a confirmation modal for deleting standard entities.
- **Implementation:** 
  1. Call moveItemToTrashPatch() from item-lifecycle.ts (sets status: 'deleted', deleted_at: <now>).
  2. Fire 	oast.success('Moved to trash', { action: { label: 'Undo', onClick: ... } }) using sonner.
  3. The undo action calls estoreItemPatch().
  4. Hard-deletion is exclusively handled asynchronously by the cron_cleanup 30-day retention job.

### 9.4 Toast Conventions
- **Pattern:** System feedback is provided via bottom-right sonner toasts.
- **Rule:** Use 	oast.success, 	oast.error, or 	oast.promise exclusively. Do not build custom snackbars. Keep messages extremely brief (e.g., 'Task moved to trash', not 'Your task has been successfully deleted.').

### 9.5 Keyboard Shortcuts
- **Pattern:** Global shortcuts (e.g., Cmd+K, Cmd+Enter) are implemented via global useEffect keydown listeners.
- **Rule:** Any visual indication of a keyboard shortcut in the UI **must** use the <Kbd> component (e.g., \<Kbd>Cmd+Enter</Kbd>\). Do not use raw spans or inline styles for shortcut hints.

