# Presense UX and Product Strategy Research Report

**Prepared For**: Presense Product and Design Team  
**Prepared By**: Project Orchestrator & UX Research Subagents  
**Date**: June 21, 2026  
**Status**: Comprehensive Codebase Audit & Competitor Benchmarking Completed  

---

## Executive Summary

Presense is a personal productivity web application engineered to act as a "second brain" for a solo student user. It aims to address cognitive challenges such as Prospective Memory Failure, Cognitive Disengagement Syndrome (CDS), and Executive Function Deficits. Unlike traditional productivity tools that present users with a blank canvas (often leading to "organization procrastination"), Presense enforces structure across four key spaces: **Do** (Tasks), **Think** (Threaded thoughts), **Remember** (People & Locations), and **Explore** (Saved links & quotes).

This report is the result of a rigorous static analysis, codebase audit, and competitor benchmarking exercise. We analyzed six core interfaces of Presense: **Inbox**, **CaptureModal**, **TaskCard**, **SettingsModal**, **ExploreDrawer**, and **ThinkThread**. We identified **18 specific UX/UI and product issues** that limit user trust, cause visual clutter, restrict mobile usage, or risk database desynchronization.

We benchmarked these issues against seven top-tier applications:
*   **Todoist** (NLP capturing, keyboard hotkeys, and list triaging)
*   **Sunsama** (Daily planning rituals, unified calendars, and transactional state-machine task movement)
*   **Things 3** (Visual hierarchy, tactile drag-and-drop feedback, and spatial task design)
*   **Capacities** (Object-based knowledge taxonomy vs. tags)
*   **TickTick** (Pomodoro timer integration, habits, and flat cache rendering)
*   **Zen Browser** (Collapsible sidebar layout, focus-trapping overlays, and keyboard-first UI navigation)
*   **Craft** (Block-based document styling, clean input layouts, and auto-growing textareas)

Based on these benchmarks, we propose concrete, actionable recommendations and extrapolate a set of new features to transition Presense from a basic collection of features into a cohesive, high-performance personal second brain.

---

## 1. Codebase Audit: The 18 Specific UX/UI & Product Issues

This section provides a detailed breakdown of the 18 specific issues identified across the six core components of Presense.

### Area A: Inbox Dropdown & Triage (`src/app/(app)/inbox/page.tsx`)

#### Issue 1: Direct Database Deletion on Space Routing (Data Integrity Risk)
*   **File & Line Reference**: `src/app/(app)/inbox/page.tsx` (Lines 54–105)
*   **Broken Behavior**: When a user routes an inbox item to another space (e.g., Think, Explore, Remember), the system performs a hard SQL deletion (`supabase.from('items').delete()`) and inserts a new row into the destination table (`people`, `explores`, `threads`). If the user clicks "Undo" in the toast notification, the system queries the database for the newest record with a matching title, deletes it, and inserts a new inbox item back into `items`. This introduces severe race conditions: if a user has two items with identical titles, the wrong record is deleted on Undo, resulting in silent data loss.
*   **Root Cause**: Brittle database architecture that deletes and recreates rows to change state, rather than using a polymorphic or unified schema with state flags.
*   **Actionable Solution**: Transition the database schema to soft-deletions/state-transitions. Keep all captured items in a unified `items` table and change their state field (e.g., `status: 'inbox' | 'active' | 'archived'`). If routed to another space, update the reference state instead of deleting the database row.

#### Issue 2: Hover-Dependent Action Buttons (Low Visual Affordance)
*   **File & Line Reference**: `src/app/(app)/inbox/page.tsx` (Line 197)
*   **Broken Behavior**: On desktop viewports, the triage action buttons ("Route it" and "Dismiss") are hidden by default (`md:opacity-0`) and only fade into view when the user hovers over a task card (`md:group-hover:opacity-100`). This lack of visual cues makes the interface feel empty and non-interactive, preventing users from discovering core routing functions unless they accidentally hover over a card.
*   **Root Cause**: A design choice that prioritizes aesthetic minimalism over functional visual affordance, violating accessibility norms (WCAG 2.1) regarding action discoverability.
*   **Actionable Solution**: Keep the triage buttons visible at a lower opacity (e.g., `opacity-60`) at all times on desktop, or display a subtle disclosure icon (e.g., a chevron) indicating that actions are available on click.

#### Issue 3: Missing Location Routing Option in dropdown
*   **File & Line Reference**: `src/app/(app)/inbox/page.tsx` (Lines 207–221)
*   **Broken Behavior**: The "Route it" dropdown panel lists options for: Do (Task), Think (Thread), Explore (Saved), and Remember (Person). It completely lacks the option to route an item to "Remember → Locations" (Where I Put It), despite this being a core space in the Presense product architecture.
*   **Root Cause**: The triage logic inside `inbox/page.tsx` was built in isolation and omitted the locations table, leaving no path to move unclassified items to the item locator.
*   **Actionable Solution**: Add a "Locations" option to the triage dropdown. When selected, call `supabase.from('locations').insert()` and delete the inbox task, or update its polymorphic category in the unified table.

---

### Area B: Quick Capture Modal & NLP (`src/components/features/CaptureModal.tsx`)

#### Issue 4: ANSI Character Encoding Corruption (Garbled UI Symbols)
*   **File & Line Reference**: `src/components/features/CaptureModal.tsx` (Lines 36, 39, 47, 48, 145, 180, 273, 280, 284, 296, 309)
*   **Broken Behavior**: Visual indicators and string matches in the dropdown contain garbled characters (e.g., `Remember â†’ People`, `Â·`, `â—¾`, `â†»`). These render as broken glyphs in the browser, making the interface look unpolished and causing potential string match failures.
*   **Root Cause**: Garbled UTF-8 character conversion (UTF-8 bytes read as Windows-1252/ANSI), representing a lack of localized string constants and character normalization in the codebase.
*   **Actionable Solution**: Normalize the codebase to UTF-8. Replace all inline garbled characters with standard string constants (e.g., replace `â†’` with a clean `→` or a Lucide icon component, and replace `â—¾` with a standard Unicode bullet or CSS square).

#### Issue 5: Fragile and Mismatched Timezone Offset Calculations
*   **File & Line Reference**: `src/components/features/CaptureModal.tsx` (Lines 288–291)
*   **Broken Behavior**: When formatting the ISO date string to be displayed inside a `<input type="datetime-local">`, the system subtracts the timezone offset in milliseconds: `new Date(item.deadline).getTime() - new Date(item.deadline).getTimezoneOffset() * 60000`. However, the `onChange` handler converts the input value straight to UTC using `new Date(e.target.value).toISOString()`. This mismatched conversion triggers off-by-one errors and shifts task deadlines based on the user's timezone offset and daylight saving status.
*   **Root Cause**: Handling timezone translation manually inside the React render cycle using raw Date operations instead of utilizing unified date-parsing utilities or standard date-picker components.
*   **Actionable Solution**: Standardize timezone conversion by using a dedicated utility library (e.g., `date-fns-tz` or `luxon`). Ensure deadlines are parsed, stored, and retrieved strictly as UTC ISO strings, with local conversions happening only at the final UI rendering boundary.

#### Issue 6: Disabled Capture Input During Route Review (Friction in Editing)
*   **File & Line Reference**: `src/components/features/CaptureModal.tsx` (Line 235)
*   **Broken Behavior**: Once the user types an input and presses Enter, the main capture text input is disabled (`disabled={!!routedItems || isRouting}`). If the user notices a spelling error or wants to add more detail to the task description, they cannot edit it directly; they are forced to click "Start over," which wipes out all extracted tags/destinations.
*   **Root Cause**: Brittle local state architecture that treats "routing preview" as a static modal state rather than a dynamic, live-editable input query.
*   **Actionable Solution**: Keep the main text area active. Allow users to edit their input text and trigger a re-parse dynamically (using a debounced handler), or allow them to edit the parsed title chip directly in place.

---

### Area C: TaskCard Component (`src/components/features/TaskCard.tsx`)

#### Issue 7: Performance Anti-Pattern: `JSON.stringify` inside React.memo
*   **File & Line Reference**: `src/components/features/TaskCard.tsx` (Lines 314–318)
*   **Broken Behavior**: When rendering long task lists, the UI stutters and drops frames during drag-and-drop actions, task completions, or filtering.
*   **Root Cause**: The custom memo comparator performs a full `JSON.stringify(prevProps.task) === JSON.stringify(nextProps.task)` comparison on every render pass. Running object serialization on every list element is a major CPU bottleneck that defeats the benefits of React.memo.
*   **Actionable Solution**: Replace the comparison with a shallow check of critical primitive fields that affect task rendering (e.g., `prevProps.task.id === nextProps.task.id && prevProps.task.title === nextProps.task.title && prevProps.task.status === nextProps.task.status && prevProps.task.priority === nextProps.task.priority`).

#### Issue 8: Rigid and Hardcoded Swipe-to-Delete Constraints
*   **File & Line Reference**: `src/components/features/TaskCard.tsx` (Lines 31, 145)
*   **Broken Behavior**: The card has a hardcoded horizontal drag limit (`left: -120`, `right: 0`) and a static delete threshold (`-80px`). Swipe gestures feel stiff and lack responsiveness, often clipping text labels or showing raw empty margins on wider mobile viewports.
*   **Root Cause**: Using fixed pixel constraints in Framer Motion's `dragConstraints` instead of using fluid percentage-based or viewport-relative elastic physics.
*   **Actionable Solution**: Convert the hardcoded swipe values to dynamic constraints calculated from the container's width (e.g., drag limit at `-25%` of container width, delete threshold at `-15%`), adding visual spring dampening.

#### Issue 9: Asymmetric Snooze Interaction (Dismiss Only, No Trigger)
*   **File & Line Reference**: `src/components/features/TaskCard.tsx` (Lines 275–294)
*   **Broken Behavior**: The task card displays an indicator showing when a task is snoozed, along with a cancel button (`Ã—`) to remove the snooze. However, there is no way to *set* a snooze on an active task from the card itself. Users must open the full task edit panel to snooze, but can unsnooze with a single tap on the card.
*   **Root Cause**: Asymmetric interaction design where the control loop for a feature is partially implemented, forcing high-friction navigation for the initial action.
*   **Actionable Solution**: Add a dedicated clock icon/button on the task card hover state. Clicking it should trigger a quick-snooze popover (with presets like "Later Today," "Tomorrow," "Next Week") without requiring the user to open the edit drawer.

---

### Area D: Settings Modal (`src/components/features/SettingsModal.tsx`)

#### Issue 10: Desynchronized Category Renaming (DB Sync Race Condition)
*   **File & Line Reference**: `src/components/features/SettingsModal.tsx` (Lines 75–99, 222–268)
*   **Broken Behavior**: Renaming a category runs a database transaction immediately to update associated `items` and `people`. However, the global category configurations and color lists in `user_settings` are saved using a 1000ms debounce handler (`useDebounce`). If a user renames a category and closes the modal or reloads the tab in less than a second, the tasks are updated to the new category name, but the category metadata list is not, causing orphaned task categories that lack color definitions.
*   **Root Cause**: Split-save strategy that mixes direct, synchronous database calls with debounced client-side background saves for user settings.
*   **Actionable Solution**: Consolidate database modifications. Perform the category list update and task renaming inside a single transaction-safe API route or PostgreSQL RPC function, ensuring both updates succeed or fail together.

#### Issue 11: Stale UI Caches After Batch Data Deletion Actions
*   **File & Line Reference**: `src/components/features/SettingsModal.tsx` (Lines 345–372)
*   **Broken Behavior**: Clicking "Clear Completed Tasks" or "Clear Stale Locations" successfully executes deletions in the Supabase backend. However, the user's dashboard still shows the deleted items until they trigger a hard browser refresh.
*   **Root Cause**: Complete lack of state invalidation or cache refetching (e.g., React Query's `queryClient.invalidateQueries`) inside the data deletion handlers.
*   **Actionable Solution**: Inject the `queryClient` instance into the `SettingsModal` and trigger query invalidations for affected queries (e.g., `["items"]`, `["locations"]`) immediately following a successful deletion response.

#### Issue 12: Silent Data Loss on Tab Transition or Modal Closure
*   **File & Line Reference**: `src/components/features/SettingsModal.tsx` (Lines 245–268)
*   **Broken Behavior**: When a user updates settings (such as changing a Display Name or adjusting Quiet Hours) and immediately switches tabs or closes the modal, their edits are silently discarded without saving.
*   **Root Cause**: The component relies entirely on the 1000ms debounce loop to auto-save. There is no auto-save listener on unmount or tab switch, nor is there a manual "Save" button to flush pending edits.
*   **Actionable Solution**: Implement an `onUnmount` hook or a `beforeunload` window event listener that flushes any pending changes in the debounce queue immediately, or add a subtle save status indicator that blocks navigation when settings are dirty.

---

### Area E: Explore Drawer (`src/components/features/ExploreDrawer.tsx`)

#### Issue 13: Overlapping Taxonomies (Custom Types vs. Tags)
*   **File & Line Reference**: `src/components/features/ExploreDrawer.tsx` (Lines 130–137)
*   **Broken Behavior**: The system implements both custom tags and custom "Types" (e.g., link, article, quote, custom). Since custom types render as simple text tags with no unique layouts or fields, this creates a confusing experience where users must decide whether to categorize an item under a type (e.g., "book") or as a tag ("book").
*   **Root Cause**: Fragmented taxonomy architecture where type parameters behave exactly like tags, leading to structural redundancy.
*   **Actionable Solution**: Remove custom user-created types. Keep a fixed, short list of core system Types (e.g., Link, Book, Note) that change the UI card style, and delegate all custom categories to the Tag system.

#### Issue 14: Fragile Document-Level Click Listener for Dropdowns
*   **File & Line Reference**: `src/components/features/ExploreDrawer.tsx` (Lines 79–83, 239, 335)
*   **Broken Behavior**: Dropdowns are managed by registering a global click handler on `document` that closes all menus. To keep the dropdowns from immediately closing on click, the trigger buttons must call `e.stopPropagation()`. This overrides standard event bubbling, causing issues when trying to integrate focus rings or browser-level click actions.
*   **Root Cause**: Anti-pattern dropdown management instead of using React ref checking (`ref.current.contains`) or robust focus-trapping primitives.
*   **Actionable Solution**: Replace custom stop-propagation dropdowns with standardized focus-trapping dropdown primitives (e.g., Radix UI Dropdown or Headless UI Menu), which handle click-outside events natively without breaking event propagation.

#### Issue 15: Context-Locked URL Input Field (Restricted Reference Input)
*   **File & Line Reference**: `src/components/features/ExploreDrawer.tsx` (Line 284)
*   **Broken Behavior**: The URL input field is hidden unless the type is set to `link` (`type === 'link'`). If a user creates an item of type "book" or "article," they cannot attach a reference link to it, rendering the link field inaccessible for all other content types.
*   **Root Cause**: Over-restrictive conditional formatting in the UI form layout, ignoring the fact that reference items typically require source URLs.
*   **Actionable Solution**: Make the URL input field always visible or move it under an optional "Source Link" toggle, letting users associate a reference URL with books, podcasts, articles, or other items.

---

### Area F: Think Space (`src/app/(app)/think/page.tsx` & `src/app/(app)/think/[id]/page.tsx`)

#### Issue 16: Jarring and Disorienting Page Transitions
*   **File & Line Reference**: `src/app/(app)/think/page.tsx` & `src/app/(app)/think/[id]/page.tsx` (Layout structures)
*   **Broken Behavior**: Navigating from the threads list to a specific thread details view wipes the entire layout and replaces it. The header, search inputs, and filter tabs disappear, causing a jarring content jump that disrupts user flow.
*   **Root Cause**: Standard route-swapping structure without shared layouts, master-detail panels, or Framer Motion layout animations to preserve context.
*   **Actionable Solution**: Rebuild the Think space as a two-column Master-Detail layout on desktop viewports. The thread list remains visible on the left side, while the active thread details panel slide-opens or populates on the right.

#### Issue 17: Concurrency Risk: JSON Array Column for Thread Entries
*   **File & Line Reference**: `src/app/(app)/think/[id]/page.tsx` (Lines 123–130)
*   **Broken Behavior**: Entries inside a thread are stored as a JSON array (`entries`) inside a single row of the `threads` table. If multiple devices append thoughts simultaneously, they overwrite each other. Additionally, the database must read/write the entire history of entries on every new thought, slowing down the app.
*   **Root Cause**: Denormalized database design where entries lack their own table/IDs, preventing standard SQL querying, indexing, and optimistic updates.
*   **Actionable Solution**: Normalize the database schema. Create a separate `thread_entries` table (`id`, `thread_id`, `user_id`, `text`, `created_at`, `starred`) with a foreign key pointing to `threads(id)`.

#### Issue 18: Hover-Only Color Picker (Mobile Incompatibility)
*   **File & Line Reference**: `src/app/(app)/think/[id]/page.tsx` (Lines 178–190)
*   **Broken Behavior**: The color accent picker is nested inside a hover-only CSS rule (`group-hover:block`). On touch devices (smartphones/tablets), this picker is inaccessible, preventing mobile users from changing their thread's accent color.
*   **Root Cause**: Relying on CSS hover states for editing actions, locking out mobile viewports that lack mouse controls.
*   **Actionable Solution**: Replace the hover-only block with a standard click-triggered popover (using Lucide icons) that works consistently on both desktop cursors and mobile touch inputs.

---

## 2. Competitor Benchmarking Matrix

This section maps the **18 identified issues** to the design patterns and product strategies used by industry leaders.

| Issue # | Component & Issue | Benchmark App | How the Competitor Addresses the Challenge |
| :--- | :--- | :--- | :--- |
| **1** | Direct DB Deletion on Space Routing | **Sunsama** | Sunsama uses a transaction-safe state machine. Moving an inbox task to the "Work" channel changes its `channel` tag but retains the original ID and record. Undo is a simple parameter update, avoiding data loss. |
| **2** | Hover-Dependent Action Buttons | **Things 3** | Things 3 avoids hiding actions. It uses subtle, low-opacity indicators or disclosure icons that are always visible, preserving visual clean lines without sacrificing discoverability. |
| **3** | Missing Location Routing Option | **Sunsama** | Sunsama treats all spaces, integrations (calendar, email, context channels), and folders as first-class citizens in the quick triage panel, preventing any one destination from being isolated. |
| **4** | ANSI Character Encoding Corruption | **Craft** | Craft uses strict UTF-8 formatting and robust text parsers to ensure symbols like arrows (`→`) and list items render correctly across all platforms and databases. |
| **5** | Fragile Timezone Calculations | **Sunsama** | Sunsama handles dates by storing timestamps in UTC. Local time formatting is handled by libraries like `date-fns` or `luxon`, preventing timezone shift errors. |
| **6** | Disabled Capture Input During Review | **Todoist** | Todoist's Quick Add features a live-editable text input. The NLP engine parses dates, tags, and projects on the fly as the user types, letting them edit their text at any time. |
| **7** | `JSON.stringify` Performance | **TickTick** | TickTick maintains flat, indexed state lists. Card updates only trigger renders on the affected item by comparing the task ID and version count, keeping lists smooth. |
| **8** | Rigid Swipe-to-Delete Constraints | **Things 3** | Things 3 uses fluid, springy physics for swipe actions. Dragging a card reveals actions (like snooze or delete) that scale with the swipe distance, offering organic feedback. |
| **9** | Asymmetric Snooze Interaction | **Sunsama** | Sunsama features a dual-action control loop. Clicking a clock icon on a task card opens a quick-snooze selector with presets, allowing users to snooze or unsnooze tasks from the same menu. |
| **10** | DB Sync Race on renaming category | **Zen Browser** | Zen Browser saves configurations immediately. Changes to tabs or settings use transactional updates with loading feedback, preventing desynchronized data states. |
| **11** | Stale Cache on Deletion | **Todoist** | Todoist uses reactive client-state management. Deleting tasks updates the local cache immediately, reflecting changes in the UI without needing a manual refresh. |
| **12** | Unsaved Settings on Exit | **Zen Browser** | Zen Browser uses immediate, non-debounced saves for important text settings, and listens for window blur/unmount events to save pending edits. |
| **13** | Overlapping Taxonomies (Types vs Tags) | **Capacities** | Capacities defines distinct types (e.g., Book, Person, Idea). Each type has unique metadata fields (e.g., Books have an Author field), while Tags are used for cross-cutting themes. |
| **14** | Fragile Click-Outside Handler | **Zen Browser** | Zen Browser uses standard accessibility primitives (like Radix UI) for dropdown menus. These components handle focus and clicks out-of-the-box, without overriding event bubbling. |
| **15** | Context-Locked URL Input | **Craft** | Craft allows metadata fields (like URLs) on all blocks. Any note can contain a URL link, regardless of whether it is typed as a web bookmark or a text note. |
| **16** | Jarring Page Transitions | **Things 3** | Things 3 keeps active panels contextually anchored and uses smooth sliding layouts to switch sub-panels (e.g. going from list to task detail uses smooth card expansion instead of jarring route swaps). |
| **17** | Concurrency Risk (JSON Array Column) | **Capacities** | Capacities treats thoughts as individual nodes linked in a database. Each entry is a separate record with a unique ID, allowing safe concurrent editing and fast queries. |
| **18** | Hover-Only Color Picker | **Things 3** | Things 3 places color and category selectors inside standard click menus, making editing options easily accessible on both desktop and touch screens. |

---

## 3. Mapping to Broader Product & Design Paradigms

Analyzing the 18 specific issues reveals four broader design and architectural failures. Resolving these failures will fix these bugs and prevent future ones.

### Paradigm A: State Transition vs. Deletion (The Sunsama Approach)
Sunsama focuses on triaging unorganized inputs. In Sunsama, a task is never destroyed to change its status; it undergoes transactional state updates. Presense's current architecture of deleting records and recreating them under different tables (e.g., routing an inbox task by deleting it and inserting a thread) is a anti-pattern that leads to data loss, breaks database-level references, and makes undo states brittle. 
*   **Resolution**: Implement a unified database schema. Tasks, notes, and links should remain in their respective primary tables with state flags, ensuring a change in type is a safe state transition.

### Paradigm B: Keyboard-First Triaging (The Todoist Approach)
For a personal capture hub, speed is the primary metric of success. Todoist allows power users to keep their hands on the keyboard. By lacking keyboard navigation and shortcuts in its lists, Presense forces users into slow pointer-based interactions, creating a barrier to daily capture and triaging.
*   **Resolution**: Build a global hotkey listener and focus-state manager. Allow users to select tasks with `j`/`k` and execute actions (e.g., route, complete, archive) with single keypresses.

### Paradigm C: Object-Based Taxonomy vs. Free-form Tags (The Capacities Approach)
Capacities avoids organizational clutter by separating "Object Types" from "Tags." An Object Type defines what an item *is* structurally (e.g., a "Book" with an author and page count), whereas Tags define its *context* (e.g., `#productivity`). Presense's Explore space mixes these, allowing users to define custom "types" that act exactly like text tags.
*   **Resolution**: Lock down "Types" to static system primitives with distinct layouts (e.g., Book card vs. Link card), and allow free-form custom tagging for categorization.

### Paradigm D: Fluid Visual Hierarchy & Transitions (The Things 3 Approach)
Things 3 is celebrated for its visual polish. Layout elements morph organically, list updates animate smoothly, and modals use spring-dampened physics. Presense's Think space thread transitions are jarring, and the TaskCard swipes feel rigid due to hardcoded constraints.
*   **Resolution**: Implement layout animations (using Framer Motion) to guide the user's eye, and replace static pixel-based drag limits with fluid, viewport-relative spring physics.

---

## 4. Extrapolated Recommendations: Beyond the 18 Issues

These new product recommendations, inspired by competitor apps, go beyond the user's initial 18 points.

### Recommendation 1: The Daily Planning and Review Ritual (Inspired by Sunsama)
*   **Product Goal**: Reduce overthinking and task initiation anxiety for students with executive dysfunction.
*   **Feature Design**: Introduce a structured **"Daily Ritual"** overlay that auto-opens when the app is first launched each day:
    1.  **Morning Briefing**: Surfaces today's calendar events, yesterday's incomplete tasks, and today's P1 priorities. The user selects exactly 3 tasks to commit to.
    2.  **Evening Review**: Prompts the user to reflect on their day. Shows completed tasks and Pomodoro sessions, and asks a single low-pressure question: "What is one thing you are proud of today?"
    3.  **Shut Down**: Automatically snoozes remaining incomplete tasks to the next day, avoiding accumulation of shame and task guilt.

### Recommendation 2: Keyboard-First Command Palette (Inspired by Todoist/Raycast)
*   **Product Goal**: Establish Quick Capture as the central command hub of the entire application.
*   **Feature Design**: Expand the `Cmd+K` Capture Modal into a full command palette:
    *   Typing `/` opens system commands: `/theme`, `/settings`, `/go do`, `/go think`.
    *   Supports quick math calculations or currency conversions locally.
    *   Provides fuzzy search across all spaces (Tasks, People, Threads, Links) inside the same modal, letting users navigate the app without touching the mouse.

### Recommendation 3: Object-Oriented Workspace & Connections (Inspired by Capacities)
*   **Product Goal**: Make Presense feel like a unified "second brain" rather than five separate apps.
*   **Feature Design**: Enable cross-linking between items:
    *   When editing a Task in Do, allow the user to link it to a Think Thread or associate it with a Person in Remember.
    *   When viewing a Person's detail page, display all associated Tasks, Think Threads, and saved Explore items in a unified relationships view.
    *   This breaks down the isolation of each space and represents the user's life as a connected graph.

### Recommendation 4: Auto-Snooze & Decay Engine (Inspired by Things 3 / Active Cleanup)
*   **Product Goal**: Keep lists clear of old, forgotten tasks without user intervention.
*   **Feature Design**: Implement an automatic **Decay Engine** for tasks and links:
    *   If a task is snoozed more than 5 times, automatically move it to a "Someday" backlog and prompt the user to break it down into smaller steps.
    *   If a link in the Explore feed is unread after 30 days, automatically archive it to the trash, ensuring the active workspace remains fresh and clutter-free.

---

## 5. Action Plan & Roadmap

To implement these recommendations, we suggest a phased development roadmap:

```
                  ┌───────────────────────────────┐
                  │ Phase 1: Database Normalization│
                  │   - Normalized thread entries │
                  │   - Soft delete state machine │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │ Phase 2: Core UX Hardening    │
                  │   - Focus-trapping dropdowns  │
                  │   - Keyboard-first inbox      │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │ Phase 3: Connected Second Brain│
                  │   - Object cross-linking      │
                  │   - Sunsama daily ritual      │
                  └───────────────────────────────┘
```

### Phase 1: Database Normalization & State Reliability (P0)
*   Create a normalized `thread_entries` table. Migrate existing JSON arrays.
*   Implement soft-deletions and state-transition logic for items and explores, replacing the direct row deletion patterns.
*   Establish transactional updates for category modifications to prevent sync errors.

### Phase 2: Core UX Hardening & Accessibility (P1)
*   Integrate Radix UI primitives for all dropdowns and modal panels to fix keyboard accessibility.
*   Add inline editing to parsed title and date chips in the Quick Capture modal.
*   Replace custom memo comparators with flat parameter checks to resolve rendering lag.

### Phase 3: Connected Second Brain & Rituals (P2)
*   Implement the Sunsama-inspired Daily Planning and Review Ritual overlay.
*   Add object cross-linking across spaces (Tasks ↔ People ↔ Threads).
*   Add the auto-growing textareas and full-width swipe spring mechanics.
