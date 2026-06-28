# Project Execution Plan - Phase 5 (Edge Auth & UUID Cross-Linking)

## Goal
Implement Next.js Edge Auth Middleware to protect application routes, and build a blazing-fast Cross-Linking & Mentions feature utilizing a PostgreSQL UUID array schema to avoid realtime sync bloat.

## Archetypes & Architecture
We follow the **Dual Track Project Pattern** with an **Implementation Track** and an **E2E Testing Track**.
Since this is a subagent-based execution, we will delegate exploration, worker changes, and review processes.

### Milestones
1. **Milestone 0: Project Diagnostics and Setup**
   - Explore existing layout, current routes, database schema, package dependencies, and supabase integration.
   - Design E2E testing framework/infrastructure.

2. **Milestone 1: Edge Auth Middleware**
   - Create a `middleware.ts` file using `@supabase/ssr` that protects all `/(app)` routes.
   - Redirect unauthenticated users to `/login`.
   - Redirect authenticated users attempting `/login` to `/`.

3. **Milestone 2: Supabase Migration for UUID Arrays**
   - Create database migration file for `linked_people` (array of UUIDs) in `items` and `threads` tables.
   - Ensure migration is compatible with Supabase CLI commands.

4. **Milestone 3: Mention UI and Parsing**
   - Implement `MentionPopover` inside `CaptureModal` and `Think` editors.
   - Parse typing of `@`, display a popover list of people, select a person, insert a visual tag.
   - Extract tags into the `linked_people` UUID array before saving to database.

5. **Milestone 4: E2E and Unit Verification**
   - Run the designed E2E test suites covering:
     - Route redirection / middleware validation.
     - Database schema presence checks.
     - Mention parsing and database insert/save checks.
   - Perform integrity audits.

## Execution Tracks
- **Track A: E2E Testing Track**
  - Create test scripts verifying security routing and database structure.
  - Implement tests verifying UI capture inserts.
- **Track B: Implementation Track**
  - Create middleware.
  - Run database migration.
  - Implement mention parsing UI/UX components.
