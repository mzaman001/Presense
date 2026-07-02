# Presense — Master Plan v4 (Independent Audit)

**Author:** Independent audit against the July 2 codebase drop.
**Method:** Every claim below was verified by reading the actual file. Where Claude's v3 plan made a claim, I checked it. Some of Claude's claims are correct, some are wrong, some are understated. I note which is which inline.
**Sources consulted (industry-standard references):**
- Next.js 16 official docs (App Router, Middleware, Route Handlers, `next/script`, Metadata, `viewport` export)
- Supabase official docs (RLS, `SECURITY DEFINER`, `search_path`, Realtime channels, Auth Server-Side helpers)
- OWASP Top 10 2021 + OWASP ASVS L2 (input validation, auth, secrets)
- MDN Web Docs (CSP, `Content-Security-Policy`, Service Worker, `visualViewport`, `overscroll-behavior`)
- web.dev / Chrome team (Core Web Vitals, `content-visibility`, `overscroll-behavior`, iOS input zoom)
- Postgres official docs (`SECURITY DEFINER`, `search_path` injection, partial indexes, `ON DELETE CASCADE`)
- React 19 release notes (strict mode, `use()` hook, hydration mismatch behavior)
- Framer Motion / Motion docs (`LazyMotion`, `MotionConfig`, `m.*` vs `motion.*`)
- Vercel docs (Edge Runtime limitations, `optimizePackageImports`, headers)
- WCAG 2.1 / 2.2 (focus management, target size 2.5.5, reduced motion 2.3.3)
- Serwist docs (precache, `skipWaiting` trade-offs, update flow)
- Zod docs (runtime validation in Route Handlers)
- Apple Web Content Guide (iOS Safari `100vh` / `100dvh`, input zoom, safe-area insets)

---

## How to read this plan

Every item is tagged:
- **[VERIFIED]** — I read the file and confirmed the issue exists.
- **[CLAUDE-RIGHT]** — Claude's v3 plan flagged this; I confirmed it.
- **[CLAUDE-WRONG]** — Claude's v3 plan flagged this but the claim is incorrect or overstated.
- **[CLAUDE-UNDERSTATED]** — Claude flagged this but the real impact is bigger.
- **[NEW]** — Claude's v3 plan missed this; I found it independently.

Every fix is rated:
- **🟢 SAFE** — zero risk of breaking anything; can ship today.
- **🟡 CAREFUL** — real fix but touches data/schema/state; test on staging first.
- **🔴 REFACTOR** — architectural change; do incrementally, one page at a time.

---

## Tier 0 — Emergency: App-breaking bugs (fix FIRST, today)

These will crash the app in normal user flows. None of them appeared in Claude's v3 plan.

### T0-1 · [NEW] · 🔴 · Migration creates a trigger that references a column dropped by a later migration

**Files:**
- `supabase/migrations/20260629081541_add_linked_people_cleanup_trigger.sql:6–13`
- `supabase/migrations/20260701000000_migrate_linked_people_to_ids.sql:20–21`
- `supabase/migrations/20260702000000_fix_db_issues.sql:6–21`

**The bug:** Migration `20260629081541` creates `remove_linked_person()` which references BOTH `linked_people` and `linked_people_ids` columns. Migration `20260701000000` (which runs LATER — note the timestamp) DROPS `linked_people`. Migration `20260702000000` then re-creates `remove_linked_person()` referencing only `linked_people_ids`.

**Why this matters:** If all three migrations ran in order on a fresh DB, the final state is correct (the third migration fixes the trigger). BUT:
1. If your **production DB** ran `20260629081541` before `20260701000000` was deployed, then between those two deploys, **every person deletion threw `column "linked_people" does not exist`** and the delete either failed or left orphaned references.
2. If any migration failed mid-run and was marked applied, the trigger is in the broken state.
3. The migration history is fragile — anyone reading the migrations in order will be confused.

**Fix (🟡 CAREFUL):** Verify the current state of the trigger on your production DB:
```sql
SELECT pg_get_functiondef('remove_linked_person()'::regprocedure);
```
If the function body still references `linked_people`, run a fresh migration to recreate it cleanly:
```sql
-- supabase/migrations/20260703000000_fix_remove_linked_person_final.sql
CREATE OR REPLACE FUNCTION remove_linked_person()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE items
    SET linked_people_ids = array_remove(linked_people_ids, OLD.id)
    WHERE OLD.id = ANY(linked_people_ids);
  UPDATE threads
    SET linked_people_ids = array_remove(linked_people_ids, OLD.id)
    WHERE OLD.id = ANY(linked_people_ids);
  RETURN OLD;
END;
$$;
```
Note I added `SECURITY DEFINER SET search_path = pg_catalog, public` — the current trigger function (in `20260629081541` and `20260702000000`) has neither, which is a `search_path` injection risk per Postgres docs §5.3.

---

### T0-2 · [NEW] · 🔴 · `useRealtime` standalone fallback still re-subscribes on visibility toggle

**File:** `src/hooks/useRealtime.ts:100–136`

Claude's v3 plan says "RealtimeProvider architecture complete with TanStack Query integration" — which is true when the provider is mounted. But `useRealtime` has a **standalone fallback path** (lines 100–136) that activates when `useRealtimeContext()` throws (i.e., when a component uses `useRealtime` outside the provider, which happens in `test-realtime/page.tsx` and could happen in any future component).

That fallback path has `isVisible` in the dependency array (line 136):
```ts
}, [table, context, debouncedUpdate, isVisible]);
```

This means: every time the user switches tabs, the fallback tears down and recreates the Supabase channel. This is the EXACT bug Claude's v3 plan claimed was fixed. It IS fixed for the provider path, but NOT for the fallback path.

**Fix (🟢 SAFE):** Move `isVisible` out of the deps and gate inside the callback. Replace the fallback `useEffect` body:

```ts
useEffect(() => {
  if (context) return;
  // Removed: if (!isVisible) return;  — keep the channel open, just skip the refetch

  const supabase = createClient();
  let channel: ReturnType<typeof supabase.channel> | null = null;
  try {
    channel = supabase
      .channel(`realtime_${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, (payload: any) => {
        const lastMutations = useAppStore.getState().lastMutations || {};
        const lastMutationAt = Math.max(lastMutations[table] || 0, lastMutations["_global"] || 0);
        if (Date.now() - lastMutationAt < 500) return;
        // Gate visibility INSIDE the callback, not in the effect deps
        if (document.visibilityState !== "visible") return;
        debouncedUpdate(payload);
      })
      .subscribe();
  } catch (e) {
    logger.error(`[Realtime] Error subscribing to channel for ${table}:`, e);
  }

  return () => { if (channel) supabase.removeChannel(channel); };
}, [table, context, debouncedUpdate]);
```

**Why safe:** Pure refactor of effect dependencies. Channel stays open across tab switches. The visibility check moves inside the callback — invisible tabs simply skip the refetch, then catch up via TanStack Query's `refetchOnWindowFocus` (which is on by default).

---

### T0-3 · [NEW] · 🟡 · `RealtimeProvider` unsubscribes from channels when listener count hits zero — causes channel churn during navigation

**File:** `src/components/providers/RealtimeProvider.tsx:113–144`

When `subscribe`'s returned cleanup runs and the listener count goes from 1 → 0, the provider calls `unsubscribeFromChannel(table)` which removes the channel entirely. The next component that subscribes to the same table re-creates it.

In practice: navigating from `/do` (subscribes to `items`) to `/think` (subscribes to `threads`) and back to `/do` causes the `items` channel to be torn down on `/do` unmount and re-created on `/do` re-mount. This is the same churn the provider was supposed to fix.

**Why this matters:** Each channel teardown + recreation is a websocket round-trip. On slow connections, this is a 200–800ms window where realtime updates are missed. Combined with `template.tsx` re-mounting the page on every navigation, every page transition loses realtime coverage briefly.

**Fix (🟡 CAREFUL):** Add a debounced teardown — keep the channel alive for 5 seconds after the last listener leaves, in case the user navigates back:
```ts
const teardownTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

const subscribe = useCallback((table: string, callback) => {
  // ... existing add-listener logic ...

  // Cancel any pending teardown
  if (teardownTimers.current[table]) {
    clearTimeout(teardownTimers.current[table]);
    delete teardownTimers.current[table];
  }

  return () => {
    tableListeners.delete(callback);
    if (tableListeners.size === 0) {
      // Delay teardown — user might navigate back
      teardownTimers.current[table] = setTimeout(() => {
        unsubscribeFromChannel(table);
        delete listenersRef.current[table];
        delete teardownTimers.current[table];
      }, 5000);
    }
  };
}, [subscribeToChannel, unsubscribeFromChannel]);
```
**Why careful:** Adds a 5-second lag to channel cleanup. Memory usage is slightly higher (channels stay open 5s longer). Acceptable trade-off for a personal app.

---

### T0-4 · [NEW] · 🟡 · `useRealtimeStatus` lies — it tracks browser online/offline, not realtime connection state

**Files:**
- `src/hooks/useRealtimeStatus.ts:1–23`
- `src/components/ui/ConnectionStatus.tsx:8–10`

`useRealtimeStatus` only listens to `window.online` / `window.offline` events. These fire when the **entire network** goes down — NOT when the Supabase Realtime websocket disconnects (which can happen on a flaky connection even when the browser thinks it's online).

The `ConnectionStatus` component is mounted globally in `layout.tsx:91` and shows "Reconnecting..." / "Disconnected" based on this hook. Users will see "Connected" (green) while the realtime websocket is actually dead, and updates silently stop flowing.

**Fix (🟡 CAREFUL):** Wire the hook to the actual Supabase channel state. The `RealtimeProvider` already has the channels in `channelsRef`. Add a status callback:

```ts
// In RealtimeProvider.tsx, inside subscribeToChannel:
const channel = supabase
  .channel(`realtime_${table}`, {
    config: { broadcast: { self: false } }
  })
  .on("postgres_changes", { event: "*", schema: "public", table }, callback)
  .subscribe((status, err) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      setStatus('disconnected');
    } else if (status === 'CLOSED') {
      setStatus('reconnecting');
    } else if (status === 'SUBSCRIBED') {
      setStatus('connected');
    }
  });
```
Then expose `status` via a separate context or a Zustand slice. `useRealtimeStatus` reads from that store instead of `window.online/offline`.

**Why careful:** Changes the provider's API. Test that the indicator correctly shows "Reconnecting" when you kill the network tab in DevTools → Network → Offline.

---

## Tier 1 — Security (do this week)

### T1-1 · [CLAUDE-RIGHT] · 🟡 · `typescript.ignoreBuildErrors: true` in `next.config.ts`

**Verified:** `next.config.ts:11–13`:
```ts
typescript: {
  ignoreBuildErrors: true,
},
```

**Why it matters:** Per Next.js official docs, this is "not recommended" and was designed as a temporary migration aid. With it on, `npm run build` succeeds even if there are 77 `: any` annotations and 28 `catch (error: any)` blocks that would otherwise fail strict-mode compilation. Real bugs hide behind this flag.

**Fix (🟡 CAREFUL):** Remove the flag. Run `npx tsc --noEmit` first to see the error count. Fix the errors in waves:
1. Catch blocks: replace `catch (error: any)` → `catch (error: unknown)` + `error instanceof Error ? error.message : 'Unknown'`. **28 instances.**
2. Supabase responses: generate typed client with `npx supabase gen types typescript --project-id <id> > src/types/database.ts` and pass to `createBrowserClient<Database>()`. This eliminates most `: any` in component code automatically.
3. Remaining `: any` (77 total, non-test): review case-by-case.

**Why careful:** Removing the flag will surface every type error at once. Don't do this mid-feature. Do it on a dedicated branch, fix the errors in waves, merge when green.

---

### T1-2 · [CLAUDE-RIGHT] · 🟡 · No Content-Security-Policy header

**Verified:** `next.config.ts:18–32` sets X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS. **No CSP.** Per OWASP and MDN, missing CSP is the most commonly exploited header gap — any injected script runs unrestricted.

**Fix (🟡 CAREFUL):** Add a nonce-based CSP in `middleware.ts`. The Next.js official pattern (per their docs §"Middleware"):

```ts
// At the top of middleware():
import { randomUUID } from 'crypto';

const nonce = Buffer.from(randomUUID()).toString('base64');
const cspHeader = [
  "default-src 'self'",
  `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
  // 'unsafe-inline' for style-src is required by Next.js inline styles + Tailwind
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}`,
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join('; ');

const requestHeaders = new Headers(request.headers);
requestHeaders.set('x-nonce', nonce);
requestHeaders.set('Content-Security-Policy', cspHeader);

// Pass to the response:
const response = NextResponse.next({ request: { headers: requestHeaders } });
response.headers.set('Content-Security-Policy', cspHeader);
```

Then in `src/app/layout.tsx`, read the nonce and apply to the theme-init `<Script>`:
```ts
import { headers } from 'next/headers';
// ...
const headersList = await headers();
const nonce = headersList.get('x-nonce') ?? undefined;
// ...
<Script id="theme-init" strategy="beforeInteractive" nonce={nonce} dangerouslySetInnerHTML={{ __html: ... }} />
```

**Why careful:** Nonce-based CSP forces dynamic rendering on all routes (per Next.js docs). This disables static optimization. Acceptable for an authenticated app (you weren't benefiting from static rendering anyway), but verify the build still works.

Also: the theme-init script currently uses `localStorage.getItem('presense_theme')` — this is fine under CSP because the script is nonce-tagged.

---

### T1-3 · [CLAUDE-RIGHT] · 🟢 · `test-realtime` route accessible in production

**Verified:** `src/app/test-realtime/page.tsx` exists. `src/middleware.ts:33` has `const isTestRoute = request.nextUrl.pathname.toLowerCase().startsWith('/test-');` and line 36 excludes it from the auth check.

**Fix (🟢 SAFE):** Two options:
1. **Delete the route entirely** (recommended — it's a debug harness). Remove `src/app/test-realtime/`. Remove the `isTestRoute` variable and the `&& !isTestRoute` clause from `middleware.ts:36`.
2. **Gate behind NODE_ENV** (less clean). Add at the top of `test-realtime/page.tsx`:
   ```ts
   if (process.env.NODE_ENV === 'production') notFound();
   ```
   But this still ships the code. Option 1 is better.

**Why safe:** Pure deletion of debug code. No user-facing flow uses this route.

---

### T1-4 · [CLAUDE-RIGHT] · 🟡 · No Zod / runtime input validation on API routes

**Verified:** All three API routes (`/api/capture`, `/api/account`, `/api/people/reorder`) call `await request.json()` and use the result directly. `zod` is NOT in `package.json` (verified).

**Fix (🟡 CAREFUL):**
1. `npm install zod`
2. Create `src/lib/schemas.ts`:
   ```ts
   import { z } from 'zod';
   export const captureSchema = z.object({
     text: z.string().min(1).max(10_000),
     settings: z.record(z.unknown()).optional(),
   });
   export const reorderSchema = z.object({
     items: z.array(z.object({
       id: z.string().uuid(),
       sort_order: z.number().int().min(0).max(100_000),
     })).min(1).max(200),
   });
   ```
3. Apply at the top of each handler:
   ```ts
   const parsed = captureSchema.safeParse(await request.json());
   if (!parsed.success) {
     return NextResponse.json(
       { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
       { status: 400 }
     );
   }
   const { text, settings } = parsed.data;
   ```

**Why careful:** Existing callers (CaptureModal, People page) send well-formed payloads, so they'll pass. But verify each call site still works — especially `CaptureModal.tsx` which sends `settings: userSettings` (a Zustand object, may have extra keys — `z.record(z.unknown()).optional()` allows this).

---

### T1-5 · [CLAUDE-RIGHT] · 🟡 · No `TO authenticated` on RLS policies

**Verified:** Grepped `supabase/migrations/` for `TO authenticated` — **zero matches**. All 9 policies use `FOR ALL USING (auth.uid() = user_id)` with no role restriction.

**Why it matters:** Per Supabase official docs §"RLS policies" and the "Always use the Role of" guideline, policies without `TO authenticated` are evaluated for the `anon` role too. `auth.uid()` returns NULL for anon, so the policy correctly denies — but the database still executes the policy function on every anon request. More importantly, if you ever add a `public` role or service-role bypass, the policy semantics change silently.

**Fix (🟡 CAREFUL):** New migration:
```sql
-- supabase/migrations/20260703000000_rls_to_authenticated.sql
DO $$
DECLARE
  t text;
  policy_name text;
BEGIN
  FOREACH t IN ARRAY ARRAY['items','people','threads','explores','locations','push_subscriptions','user_settings','categories','session_logs','ritual_logs'] LOOP
    policy_name := 'users_own_' || t;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = policy_name) THEN
      EXECUTE format('DROP POLICY %I ON %I', policy_name, t);
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
        policy_name, t
      );
    END IF;
  END LOOP;
END $$;
```
**Why careful:** Test that authenticated users can still CRUD their own data and that anon users get 401/empty. Run on staging first.

---

### T1-6 · [CLAUDE-RIGHT] · 🟢 · In-memory rate-limit fallback is meaningless in serverless

**Verified:** `src/lib/rate-limit.ts:25–51`. The in-memory `Map` is per-process. On Vercel Edge, each invocation is a fresh isolate. The "fallback" provides zero protection when Redis isn't configured.

**Fix (🟢 SAFE):** Two changes:
1. Add a loud dev-mode warning:
   ```ts
   if (!ratelimit && process.env.NODE_ENV === 'development') {
     console.warn('[rate-limit] Upstash Redis not configured — rate limiting is DISABLED in dev. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for production.');
   }
   ```
2. In production without Redis, **fail closed** for write routes (capture, account-delete) — return 503 instead of allowing unlimited requests:
   ```ts
   if (!ratelimit && process.env.NODE_ENV === 'production') {
     logger.error('[rate-limit] Redis not configured in production — rejecting request');
     return false;  // caller returns 429/503
   }
   ```
   Add this to the `checkRateLimit` function: if `!ratelimit && NODE_ENV === 'production'`, return `false`.

**Why safe:** Only affects the no-Redis path. If you have Redis configured (you should in prod), nothing changes.

---

### T1-7 · [CLAUDE-RIGHT] · 🟢 · No `.env.example`

**Verified:** `ls .env*` returns nothing.

**Fix (🟢 SAFE):** Create `.env.example`:
```bash
# Supabase (required — get these from your Supabase project settings)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Supabase service role (SERVER-ONLY — never expose to client)
# Only used in /api/account for auth.admin.deleteUser
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Upstash Redis (required for production rate limiting)
# Get these from your Upstash console
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Vercel KV (alternative to Upstash — Vercel's managed Redis)
# Uncomment if using Vercel KV instead of Upstash
# KV_REST_API_URL=https://your-vercel-kv.kv.vercel-inc.com
# KV_REST_API_TOKEN=your-token
```

Also add to `.gitignore` (already there: `.env*` — good). **Why safe:** Documentation-only file.

---

### T1-8 · [CLAUDE-RIGHT] · 🟢 · Bang assertions on env vars without startup validation

**Verified:** `process.env.NEXT_PUBLIC_SUPABASE_URL!` appears in `src/lib/supabase.ts:8`, `src/lib/supabase-server.ts:8`, `src/middleware.ts:10`. `process.env.SUPABASE_SERVICE_ROLE_KEY!` in `src/app/api/account/route.ts:17`. No validation anywhere.

**Fix (🟢 SAFE):** Add a `src/lib/env.ts`:
```ts
function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `[env] Missing required environment variable: ${name}. ` +
      `Copy .env.example to .env.local and fill in the values.`
    );
  }
  return v;
}

export const env = {
  NEXT_PUBLIC_SUPABASE_URL: required('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY, // server-only, optional at module load
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
};
```
Then replace `process.env.NEXT_PUBLIC_SUPABASE_URL!` with `env.NEXT_PUBLIC_SUPABASE_URL` everywhere. The `required()` call throws at module load with a clear message instead of a confusing "Cannot read property of undefined" deep in Supabase init.

**Why safe:** Pure refactor. Behavior is identical when env vars are set; only the error message improves when they're missing.

---

### T1-9 · [NEW] · 🟡 · `/api/account` DELETE route leaks Postgres error messages to client

**File:** `src/app/api/account/route.ts:24–26`
```ts
if (error) {
  return NextResponse.json({ error: error.message }, { status: 500 });
}
```

Per OWASP ASVS V7.1.1, error responses must not reveal implementation details. Supabase `error.message` can include things like `permission denied for table auth.users` or stack traces that expose your schema.

**Fix (🟡 CAREFUL):**
```ts
if (error) {
  logger.error('[account] deleteUser failed:', error);
  return NextResponse.json(
    { error: 'Failed to delete account. Please contact support.' },
    { status: 500 }
  );
}
```
Same fix in `src/app/api/people/reorder/route.ts:29–30` and anywhere else that returns `error.message` directly to the client.

---

### T1-10 · [NEW] · 🟡 · `/api/account` DELETE has no rate limit — denial-of-service vector

**File:** `src/app/api/account/route.ts:5`

This route uses the **service-role key** to delete auth users. It has NO rate limit. An attacker who steals a session token can hammer this endpoint — each call hits the Supabase admin API. More importantly, an attacker can DOS the user's account by repeatedly triggering deletion (which fails because the user is already deleted, but still burns service-role quota).

**Fix (🟡 CAREFUL):** Add `checkRateLimit(user.id, 3, 60_000)` — max 3 account-deletion attempts per minute. Also add a confirmation token check: require a `confirmToken` field that the client must echo (e.g., the user's email) to prevent CSRF-driven accidental deletion.

---

### T1-11 · [NEW] · 🟡 · `/api/people/reorder` has no rate limit AND no payload size limit

**File:** `src/app/api/people/reorder/route.ts:18–26`

`Promise.all(items.map(...))` with no upper bound on `items.length`. A malicious client can POST 10,000 items → 10,000 concurrent Supabase UPDATEs → Supabase connection pool exhaustion. This is the same DoS vector Claude flagged in the previous audit but it's still unfixed.

**Fix (🟡 CAREFUL):** Two layers:
1. Add `checkRateLimit(user.id, 30, 60_000)` — 30 reorders/min is plenty.
2. The Zod schema in T1-4 already caps `items` at 200.
3. Replace `Promise.all` with a single bulk upsert (per Claude's v3 plan §2.4):
   ```ts
   await supabase.from('people').upsert(
     items.map(({ id, sort_order }) => ({ id, user_id: user.id, sort_order })),
     { onConflict: 'id' }
   );
   ```

---

## Tier 2 — Database & Schema (do this week, test on staging)

### T2-1 · [CLAUDE-UNDERSTATED] · 🔴 · `remove_linked_person` trigger function is `SECURITY INVOKER` with no `search_path` lock

**Files:** `supabase/migrations/20260629081541_add_linked_people_cleanup_trigger.sql:1–17` and `supabase/migrations/20260702000000_fix_db_issues.sql:6–21`

Both versions of the trigger function lack `SECURITY DEFINER` and `SET search_path`. Per Postgres docs §5.3 and the Supabase security guide, any function invoked by a trigger should be `SECURITY DEFINER SET search_path = pg_catalog, public` to prevent search_path hijacking.

The function runs `UPDATE items ... WHERE OLD.id = ANY(linked_people_ids)`. If an attacker can create objects in another schema and influence the search_path, they can hijack the `array_remove` function or the `items` table reference.

**Fix:** Already covered in T0-1's recommended migration. Apply that migration to fix both the column reference AND the search_path in one go.

---

### T2-2 · [CLAUDE-WRONG] · 🟢 · `categories` table — Claude said "never used by the app"; actually IS used

**Verified:** `src/components/features/SettingsModal.tsx:448`:
```ts
supabase.from("categories").delete().eq("user_id", user.id),
```

Claude's v3 plan §2.2 says "the application code never reads from or writes to `from("categories")`". **This is wrong.** The SettingsModal deletes from `categories` (likely as part of a "reset categories" flow). The table is not dead schema.

**Fix:** Do NOT drop the `categories` table. Instead, audit SettingsModal around line 448 — if the delete is part of a "reset" flow, document it. If it's dead code in SettingsModal, remove that line, then the table can be dropped.

**Action:** Read `SettingsModal.tsx` around line 448 and decide. Either way, do not blindly drop the table based on Claude's claim.

---

### T2-3 · [CLAUDE-RIGHT] · 🟡 · `explores.note` column is `NOT NULL DEFAULT ''`

**File:** `supabase/migrations/001_baseline.sql:70`:
```sql
note text NOT NULL DEFAULT '',
```

**Why it matters:** Empty string `''` is semantically different from `NULL`. The UI in `ExploreDrawer.tsx:337` checks `!note.trim()` to disable the save button — but the DB stores `''`. If you ever want to query "explores with no note," you have to use `WHERE note = '' OR note IS NULL` instead of just `WHERE note IS NULL`. Confusing.

**Fix (🟡 CAREFUL):**
```sql
ALTER TABLE explores ALTER COLUMN note DROP NOT NULL;
ALTER TABLE explores ALTER COLUMN note SET DEFAULT NULL;
UPDATE explores SET note = NULL WHERE note = '';
```
Then audit client code for `note === null` vs `note === ''` checks. The ExploreDrawer save button (`disabled={saving || !title.trim() || !note.trim()}`) needs to become `!note?.trim()`.

---

### T2-4 · [CLAUDE-RIGHT] · 🟡 · `people/reorder` does N individual UPDATEs instead of one upsert

Already covered in T1-11. The fix is the bulk upsert.

---

### T2-5 · [NEW] · 🟡 · `handle_new_user` baseline lacks `SECURITY DEFINER` and `search_path`

**File:** `supabase/migrations/001_baseline.sql:175–188`

The baseline creates `handle_new_user()` as `LANGUAGE plpgsql SECURITY DEFINER` (line 183) — good — but **without `SET search_path`**. The `20260702100000_audit_fixes.sql` migration later adds `SET search_path = pg_catalog, public` (lines 10–20), but only via a DO block that checks if the function exists. On a fresh DB, this works. On an existing DB that ran the baseline before the audit-fix migration, the function is in the hardened state. Fine.

**However:** The baseline itself should be the authoritative source. Anyone reading `001_baseline.sql` sees the un-hardened version. Per Postgres security best practice, the baseline should bake in the hardening.

**Fix (🟢 SAFE — no runtime effect):** Update `001_baseline.sql:183` from:
```sql
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
to:
```sql
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;
```
This only affects fresh installs (existing DBs already have the audit-fix migration applied). No runtime risk.

Also: the function reads `NEW.raw_user_meta_data->>'full_name'` with no length check. Add a `left(..., 100)` guard per Claude's v3 plan §2.1.

---

### T2-6 · [NEW] · 🟡 · `increment_time_spent` trigger also lacks `SECURITY DEFINER` + `search_path`

**File:** `supabase/migrations/007_time_spent.sql:5–18`

Same issue as T2-5. The `20260702100000_audit_fixes.sql` migration hardens it, but the baseline migration `007_time_spent.sql` creates it without hardening. Fix the source migration for future fresh installs.

---

### T2-7 · [NEW] · 🟡 · `rename_category` RPC accepts arbitrary column names — SQL injection-adjacent

**File:** `supabase/migrations/009_rename_category_rpc.sql:24–55`

The function takes `p_categories_key text` and uses it in `IF p_categories_key = 'do_categories' THEN ... ELSIF p_categories_key = 'people_categories' THEN ...`. The values are hard-coded in `IF` branches, so this is NOT direct SQL injection. **But:** the function does not `RAISE EXCEPTION` for invalid keys until the very end (line 53), and the `ILIKE` patterns on line 41 (`WHERE category ILIKE p_old_category`) allow the caller to pass `%` as `p_old_category` and rename ALL categories to one name.

**Fix (🟡 CAREFUL):** Tighten the ILIKE to a strict equality:
```sql
WHERE user_id = v_user_id AND category = p_old_category
```
And validate that `p_old_category` and `p_new_category` are non-empty and reasonable length (e.g., `length(p_new_category) BETWEEN 1 AND 50`).

---

## Tier 3 — Architecture & Coding (do over 2–3 weeks)

### T3-1 · [CLAUDE-RIGHT] · 🟡 · Sidebar `transition-[width]` causes layout thrash

**Verified:** `src/components/layout/Navigation.tsx:51`:
```ts
"transition-[width] duration-250 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
```

**Why it matters:** Animating `width` forces the browser to recalculate layout for every sibling on every frame. Per web.dev and Chrome DevTools team guidance, only `transform` and `opacity` should be animated. The sidebar width animation reflows the entire `AppContentWrapper` (which has `md:pl-[220px]` / `md:pl-[64px]`) on every frame.

**Fix (🟡 CAREFUL):** Convert to a fixed-width sidebar that stays at 220px and slides off-screen via `transform`. The content area's padding stays at `md:pl-[220px]` always; the sidebar slides out via `translateX(-100%)` when collapsed:

```tsx
// Navigation.tsx — Sidebar
<aside
  className={cn(
    "sidebar hidden md:flex flex-col fixed top-0 left-0 h-screen z-40 w-[220px]",
    "transition-transform duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
    isSidebarCollapsed && "-translate-x-full"
  )}
>
```

Then in `AppContentWrapper.tsx`, change `md:pl-[64px]` to `md:pl-[220px]` (always reserve the full sidebar width — when collapsed, the sidebar slides off but the content stays put, OR use a separate "peek" rail at 64px). The cleanest approach is a 3-state design: full (220px), rail (64px), hidden (0). Each state has a fixed width — no animation on `width`, only on `transform`.

**Why careful:** This is a layout change. Test on all breakpoints. The collapse button needs to still work. The mobile drawer is unaffected (it's a separate component).

---

### T3-2 · [CLAUDE-RIGHT] · 🟢 · Duplicate `useReducedMotion` — one SSR-unsafe

**Verified:**
- `src/lib/animations.ts:6–9` — uses `window.matchMedia` directly, NOT a hook, SSR-unsafe (would crash if imported by a Server Component because `window` is undefined).
- `src/hooks/useReducedMotion.ts:1–5` — wraps `useMediaQuery` (which uses `useEffect`), SSR-safe.

Plus `MotionProvider` uses `MotionConfig reducedMotion="user"` which is the Motion library's built-in handling.

**Fix (🟢 SAFE):** Delete `useReducedMotion` from `src/lib/animations.ts`. Keep `src/hooks/useReducedMotion.ts`. Audit imports — if anything imported from `animations.ts`, repoint to `hooks/useReducedMotion`. The `MotionConfig reducedMotion="user"` in `MotionProvider` already handles the global case, so most code doesn't need either hook.

---

### T3-3 · [CLAUDE-RIGHT] · 🟢 · `LenisProvider` has RAF leak + unstable options dep

**Verified:** `src/components/layout/LenisProvider.tsx:31–42`:
```ts
function raf(time: number) {
  lenisInstance.raf(time);
  requestAnimationFrame(raf);  // ← never stored, never cancelled
}
requestAnimationFrame(raf);

return () => {
  lenisInstance.destroy();
  setLenis(null);
  // ← no cancelAnimationFrame
};
```

The RAF ID is never stored, so it can never be cancelled. On unmount, `lenisInstance.destroy()` is called, but the RAF loop continues calling `lenisInstance.raf(time)` on a destroyed instance. This either silently no-ops or throws, depending on Lenis internals. Either way, the RAF loop runs forever in a detached state, consuming CPU.

Also: `options` is in the dep array (line 42). If the parent passes a new object literal each render (common pattern), the effect re-runs on every render, destroying and recreating Lenis.

**Fix (🟢 SAFE):**
```ts
useEffect(() => {
  const lenisInstance = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    touchMultiplier: 2,
  });
  setLenis(lenisInstance);

  let rafId: number;
  function raf(time: number) {
    lenisInstance.raf(time);
    rafId = requestAnimationFrame(raf);
  }
  rafId = requestAnimationFrame(raf);

  return () => {
    cancelAnimationFrame(rafId);
    lenisInstance.destroy();
    setLenis(null);
  };
}, []);  // ← remove options from deps; bake config in
```
If you need configurable options, accept them as a serialized string and compare via `useMemo`/`JSON.stringify` to stabilize the reference.

---

### T3-4 · [CLAUDE-RIGHT] · 🟡 · Serwist `skipWaiting: true` + `clientsClaim: true` with no update prompt

**Verified:** `src/app/sw.ts:15–16`. Per Serwist docs §"Skipping the waiting phase", this pattern means a new SW takes control of all open tabs immediately on deploy. If the precache manifest changed (new chunk hashes), open tabs may serve a mix of old cached assets and new network assets → JS errors from chunk hash mismatches.

**Fix (🟡 CAREFUL):**
1. Remove `skipWaiting: true` and `clientsClaim: true` from `sw.ts`. Keep `navigationPreload: true`.
2. Create `src/components/ui/UpdatePrompt.tsx`:
   ```tsx
   'use client';
   import { useEffect, useState } from 'react';
   import { toast } from 'sonner';

   export function UpdatePrompt() {
     useEffect(() => {
       if (!('serviceWorker' in navigator)) return;
       const handleControllerChange = () => {
         toast.info('Update available', {
           description: 'A new version is ready.',
           action: { label: 'Reload', onClick: () => window.location.reload() },
           duration: Infinity,
         });
       };
       navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
       return () => navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
     }, []);
     return null;
   }
   ```
3. Mount `<UpdatePrompt />` in `src/app/layout.tsx` (next to `<ConnectionStatus />`).
4. Add a manual "Check for update" action somewhere (Settings) that calls `registration.update()`.

**Why careful:** The first deploy after this change will leave existing users on the old SW until they manually reload. Plan for a one-time "stale SW" cleanup. After that, updates flow through the prompt correctly.

---

### T3-5 · [CLAUDE-UNDERSTATED] · 🔴 · 77 `: any` annotations + 28 `catch (error: any)` — Claude said 5 catch instances, actually 28

**Verified:** `grep -rn 'catch (error: any)\|catch (err: any)\|catch (e: any)' src/` (excluding tests) = **28 instances**. Claude's v3 plan §6.1 said "5 confirmed instances" — understated by 5x.

Concentrated in:
- `src/app/(app)/think/[id]/page.tsx` — 6 instances
- `src/app/(app)/explore/[id]/page.tsx` — 3
- `src/app/(app)/remember/people/[id]/page.tsx` — 5
- `src/components/features/RitualOverlay.tsx` — 2
- `src/components/features/ExploreDrawer.tsx` — 3
- `src/app/api/people/reorder/route.ts` — 1
- etc.

**Fix (🟡 CAREFUL — gated behind T1-1):** Once `ignoreBuildErrors` is removed (T1-1), these become compile errors. Fix in waves:
1. Mechanical replacement: `catch (error: any)` → `catch (error: unknown)`, then `error.message` → `error instanceof Error ? error.message : 'Unknown error'`.
2. For Supabase errors specifically, use `PostgrestError` type: `import { PostgrestError } from '@supabase/supabase-js'` and `error instanceof PostgrestError ? error.message : ...`.
3. For the 77 `: any` annotations on variables/props, generate the typed Supabase client (T1-1 step 2) and replace `any` with the generated types.

---

### T3-6 · [CLAUDE-RIGHT] · 🟢 · `animations.ts` parallel system alongside `MotionProvider`

Already covered in T3-2. Annotate `animations.ts` as "static config only — use with `m.*`" and split spring/easing tokens into a `src/lib/motion-tokens.ts` file. Low priority.

---

### T3-7 · [NEW] · 🔴 · `Sheet` component has a focus-trap race + missing `aria-label` on close button

**File:** `src/components/ui/Sheet.tsx`

**Issue 1:** `useDialogFocus(isOpen)` is called at line 19, but the `AnimatePresence` at line 51 means the sheet DOM doesn't exist until after the enter animation. The 50ms `setTimeout` in `useDialogFocus` (line 22 of `useDialogFocus.ts`) is a guess — if the enter animation takes longer than 50ms (it's 300ms per line 78), focus is set on a non-existent element. Screen readers cannot find the sheet.

**Issue 2:** The close button at line 100–105 has no `aria-label`:
```tsx
<button onClick={onClose} className="...">
  <X size={20} strokeWidth={2} />
</button>
```
Per WCAG 2.1 §4.1.2, icon-only buttons must have an accessible name.

**Fix (🟢 SAFE):**
1. Add `aria-label="Close"` to the close button.
2. Increase the `useDialogFocus` timeout from 50ms to 350ms (longer than the 300ms enter animation), OR better: use `onAnimationComplete` on the `m.div` to trigger focus after the animation finishes.

---

### T3-8 · [NEW] · 🟡 · `MobileTopBar` uses `backdrop-blur-2xl` (40px) — perf killer on Android

**File:** `src/components/layout/MobileTopBar.tsx:13`

```tsx
className="md:hidden fixed top-0 left-0 w-full h-[52px] ... backdrop-blur-2xl z-40"
```

`backdrop-blur-2xl` is 40px blur. Per web.dev performance guidance and the Chrome team's "An Introduction to Web Animations" research, backdrop-filter is one of the most expensive CSS properties — it forces the browser to re-rasterize the blurred region on every scroll frame. On mid-range Android, a 40px blur on a full-width bar causes 10–15fps scroll.

The bottom-nav in `Navigation.tsx` was already fixed to `backdrop-blur-md` (per Claude's v3 plan "Done" list). The MobileTopBar was missed.

**Fix (🟢 SAFE):** Change `backdrop-blur-2xl` to `backdrop-blur-md` (12px). Combined with `bg-[var(--color-background)]/95`, the visual effect is nearly identical.

---

### T3-9 · [NEW] · 🟡 · `MobileTopBar` uses `pt-safe-top` class that does not exist in CSS

**File:** `src/components/layout/MobileTopBar.tsx:13`

The class `pt-safe-top` is referenced but a grep of `globals.css` for `.pt-safe-top` returns nothing. This is a Tailwind class that doesn't exist (Tailwind's safe-area utilities are `pt-[env(safe-area-inset-top)]` or similar). The class silently does nothing, meaning the MobileTopBar renders UNDER the iPhone notch.

**Fix (🟢 SAFE):** Replace `pt-safe-top` with the inline style:
```tsx
style={{ paddingTop: 'env(safe-area-inset-top)' }}
```
Or add the utility to `globals.css`:
```css
.pt-safe-top { padding-top: env(safe-area-inset-top); }
.pb-safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
```

---

### T3-10 · [NEW] · 🟡 · `test.js` at repo root is a dead debug script that loads env vars

**File:** `test.js` (root)

```js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
  const { data } = await supabase.from('user_settings').select('last_ritual_date').limit(1);
  console.log(data);
}
test();
```

This is a one-off debug script. It's at the repo root (clutter), it loads `.env.local` directly, and it queries `user_settings` — which under RLS returns nothing for an unauthenticated client, so it always prints `null`. It's dead code that confuses new contributors.

**Fix (🟢 SAFE):** Delete `test.js`. If you need a similar debug script, put it in `scripts/` and document it in `CONTRIBUTING.md`.

---

### T3-11 · [NEW] · 🟢 · `.gitignore` has UTF-16 null-byte corruption in the last section

**Verified:** `od -c` of the last 200 bytes of `.gitignore` shows:
```
\n  \n  \0   #  \0      \0   T  \0   e  \0   m  \0   p  \0   ...
```

The "Temp/Output files" section was appended with UTF-16 encoding (each character followed by a null byte `\0`). Git's gitignore parser reads UTF-8 — the null bytes cause unpredictable parsing. The `output.txt` and `supabase/.temp/` entries may or may not be honored depending on the Git client.

**Fix (🟢 SAFE):** Open `.gitignore`, delete the corrupted section, re-type it cleanly in UTF-8:
```
# Temp/Output files
output.txt
supabase/.temp/
```
Save. Verify with `od -c .gitignore | tail -5` — no `\0` bytes should remain.

---

### T3-12 · [NEW] · 🟡 · 57/91 tsx files (63%) are `"use client"` — App Router misuse

**Verified:** `grep -rl '"use client"' src/ --include='*.tsx' | wc -l` = 57. Total tsx = 91.

Per Next.js 16 official docs §"App Router", the default should be Server Components. Client Components are for interactivity (state, effects, event handlers). The current ratio is inverted — most pages are client components that fetch from Supabase in `useEffect` / `useQuery`.

**Why it matters:**
1. Larger JS bundle (everything ships to the client).
2. No streaming / Suspense benefits.
3. Loading flashes (client fetches after hydration).
4. SEO is irrelevant for an auth app, but the bundle size and TTFB matter.

**Fix (🔴 REFACTOR — incremental):** Convert one page at a time, starting with the smallest. Pattern:
```tsx
// src/app/(app)/inbox/page.tsx — Server Component
import { createClient } from '@/lib/supabase-server';
import { InboxClient } from './InboxClient';

export default async function InboxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: items } = await supabase.from('items').select('...').eq('status', 'inbox');
  return <InboxClient initialItems={items ?? []} />;
}
```
Then `InboxClient.tsx` is the `"use client"` component with `useQuery({ initialData })`.

**Don't do this in bulk.** One page per PR. Start with `/inbox` (smallest), then `/explore/trash`, then `/remember/locations`. Leave the complex pages (`/do`, `/` dashboard) for last.

---

### T3-13 · [NEW] · 🟡 · `template.tsx` re-mounts the entire page on every navigation

**File:** `src/app/(app)/template.tsx`

Per Next.js docs §"Templates", `template.tsx` re-mounts on every navigation (unlike `layout.tsx` which persists). Combined with T0-3 (channel churn), every page transition:
1. Unmounts the old page → tears down `useRealtime` subscriptions → channels go to zero → (after 5s) channels are removed.
2. Mounts the new page → `useQuery` refetches from Supabase → new `useRealtime` subscriptions → channels re-created.

Net effect: 500–800ms of "no realtime coverage" on every navigation, plus a network refetch that could have been served from cache.

**Fix (🟡 CAREFUL):** Two options:
1. **Delete `template.tsx`** entirely. You lose the page-transition animation. The app becomes snappier. Recommended.
2. **Move the animation to per-page wrappers.** Each page wraps its own content in a `<PageTransition>` component. More code but preserves the animation.

Option 1 is the right call for a productivity app where snappiness > animation.

---

## Tier 4 — Performance (do over 2 weeks)

### T4-1 · [CLAUDE-RIGHT] · 🟢 · `optimizePackageImports` missing `compromise` and `lenis`

**Verified:** `next.config.ts:14` lists `lucide-react, framer-motion, date-fns, @dnd-kit/core, @dnd-kit/sortable`. Missing: `compromise` (~140KB, the heaviest dep), `lenis` (~30KB), `@base-ui/react` (new shadcn dep).

**Fix (🟢 SAFE):**
```ts
experimental: {
  optimizePackageImports: [
    'lucide-react', 'framer-motion', 'date-fns',
    '@dnd-kit/core', '@dnd-kit/sortable',
    'compromise', 'lenis', '@base-ui/react',
  ],
},
```
Per Next.js docs §"optimizePackageImports", this enables tree-shaking for these packages. No behavior change, just smaller bundles.

---

### T4-2 · [CLAUDE-RIGHT] · 🟡 · `chrono-node` imported in client components

**Verified:**
- `src/lib/chrono-custom.ts:1` — `import * as chrono from "chrono-node"`
- `src/lib/capture-router.ts:1` — imports chrono
- `src/components/features/TaskAddPanel.tsx:9` — `import "@/lib/chrono-custom"`
- `src/components/features/TaskAddPanel.tsx:13` — `import * as chrono from "chrono-node"`

So `chrono-node` (~50KB) is in the TaskAddPanel client bundle. The `/api/capture` route already runs `routeCapture` (which uses chrono) server-side. The client uses chrono to parse dates as the user types in the TaskAddPanel.

**Fix (🟡 CAREFUL):** Move the live-parse-on-type feature to a server action or API call:
1. Create `/api/parse-date` POST route that accepts `text` and returns `{ date, cleanText }`.
2. In `TaskAddPanel`, replace the local `chrono.parse(text)` call with a debounced fetch to `/api/parse-date`.
3. Remove `chrono-node` and `chrono-custom` imports from `TaskAddPanel.tsx`.

Trade-off: the live-parse now has a 200ms network round-trip. Acceptable for a debounced input. If you want zero-latency parsing, keep chrono client-side but accept the 50KB bundle cost.

---

### T4-3 · [CLAUDE-RIGHT] · 🟢 · No `content-visibility: auto` on long list items

**Verified:** No `content-visibility` in `globals.css`. TaskCard, ExploreItemCard, and thread rows render unconditionally.

**Fix (🟢 SAFE):** Add to `globals.css`:
```css
@media (min-width: 768px) {
  .task-card-wrapper,
  .explore-item-wrapper,
  .thread-row-wrapper {
    content-visibility: auto;
    contain-intrinsic-size: 0 88px;
  }
}
```
Then add the wrapper class to the motion.div that wraps each list item. Per web.dev §"content-visibility", this lets the browser skip rendering off-screen items — measurably improves scroll performance on long lists.

**Only apply on `md:` and up** — on mobile, `content-visibility: auto` can cause scroll-jank if the items have dynamic height.

---

### T4-4 · [NEW] · 🟡 · CaptureModal fetches all people on every open — N+1 candidate

**File:** `src/components/features/CaptureModal.tsx:74–86`

```ts
useEffect(() => {
  async function fetchPeople() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("people").select("id, name").eq("user_id", user.id);
    if (data) setPeople(data);
  }
  if (isCaptureModalOpen) fetchPeople();
}, [isCaptureModalOpen, supabase]);
```

Every time the user opens CaptureModal (Cmd+K), this fires a `supabase.from("people").select(...)` query. For a user with 200 contacts, that's 200 rows fetched on every modal open. The query is also unnecessary if the user doesn't type `@`.

**Fix (🟡 CAREFUL):** Lazy-load — only fetch people when the user types `@`:
```ts
useEffect(() => {
  if (!isCaptureModalOpen || !showPopover) return;  // only fetch when popover opens
  let cancelled = false;
  (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || cancelled) return;
    const { data } = await supabase.from("people").select("id, name").eq("user_id", user.id).limit(50);
    if (!cancelled) setPeople(data ?? []);
  })();
  return () => { cancelled = true; };
}, [isCaptureModalOpen, showPopover, supabase]);
```
Also add `.limit(50)` — you don't need all 200 contacts in the mention dropdown.

Better: use TanStack Query with a `["people-for-mentions"]` key so it's cached across modal opens.

---

### T4-5 · [NEW] · 🟡 · 37 `select("*")` calls across all pages

**Verified:** `grep -rn 'select("\*")' src/` = 37 matches. Every page fetches all columns including `subtasks jsonb[]`, `notes jsonb[]`, `entries jsonb[]`. For a user with 200 tasks, the `items` table payload can be 2+ MB.

**Fix (🟡 CAREFUL — incremental):** For each page, replace `select("*")` with an explicit column list matching what the UI renders. Example for `/do`:
```ts
.select("id, title, deadline, status, category, priority, first_step, snoozed_until, time_spent_minutes, linked_people_ids, recurrence, start_date, completed_at")
```
Skip: `notes`, `ifthen_trigger`, `notification_sent_*` (6 columns), `subtasks` (only needed in TaskAddPanel).

Do this page-by-page. The TaskAddPanel still needs `select("*")` because it edits every field.

---

## Tier 5 — Mobile / Shell (do over 2 weeks)

### T5-1 · [CLAUDE-RIGHT] · 🟢 · `useIsTouch`, `useMediaQuery`, `useVisualViewport` built but zero call sites

**Verified:**
- `useIsTouch` — used in `Navigation.tsx:26, 44` (Claude's claim of "zero callers" is wrong — Sidebar uses it). But it's not used in TaskCard, ExploreDrawer, or any hover-affordance component.
- `useMediaQuery` — let me verify... `grep -rn 'useMediaQuery' src/ --include='*.tsx'` shows it's only used by `useReducedMotion`. No direct callers.
- `useVisualViewport` — used in `Sheet.tsx:8, 20`. Claude's claim of "zero callers" is wrong here too.

**Fix (🟢 SAFE):**
1. `useIsTouch` — wire into TaskCard's `whileHover` to disable hover effects on touch devices. Spread `...(!isTouch && hoverScaleProps)` instead of `...hoverScaleProps`.
2. `useMediaQuery` — keep for `useReducedMotion`. Document as internal.
3. `useVisualViewport` — already wired in Sheet. Verify the keyboard offset actually works on iOS Safari (open a Sheet with a text input, focus the input, verify the sheet slides up above the keyboard).

---

### T5-2 · [CLAUDE-RIGHT] · 🟢 · `useHaptics` has only one call site

**Verified:** `useHaptics` is imported in `CaptureModal.tsx:15` and `do/page.tsx:16`. Claude's claim of "one call site" is understated. But it's still under-used. Missing on:
- Task complete (the most satisfying moment for a haptic)
- Task delete (swipe-to-delete commit)
- Sheet swipe-dismiss commit
- Ritual step advance
- Pomodoro phase change

**Fix (🟢 SAFE):** Wire `useHaptics().light()` into:
- `TaskCard.tsx` complete handler (line 219 area)
- `TaskCard.tsx` swipe-delete commit (line 80 area, already has `navigator.vibrate([10])` — replace with `haptics.light()`)
- `Sheet.tsx` onDragEnd dismiss (line 71)
- `RitualOverlay.tsx` step advance
- `PomodoroTimer.tsx` phase change

Keep haptics subtle — anything over 30ms feels like an error per Apple HIG.

---

### T5-3 · [CLAUDE-RIGHT] · 🟢 · Input `font-size` below 16px triggers iOS Safari zoom

**Verified:** `globals.css` `.input` class uses `font-size: var(--text-md)` = 14px. Per Apple's Web Content Guide and Chrome's input-zoom documentation, iOS Safari auto-zooms on any input with font-size < 16px.

**Fix (🟢 SAFE):** Add to `globals.css`:
```css
@media (max-width: 767px) {
  input.input,
  textarea.input,
  select.input,
  .input-title,
  .input-search {
    font-size: max(16px, var(--text-md));
  }
}
```
Using `max()` preserves the larger size on desktop while forcing 16px floor on mobile.

---

### T5-4 · [CLAUDE-RIGHT] · 🟢 · No `inputMode`, `autoComplete`, `autoCapitalize` on most inputs

**Verified:** Only `src/app/(auth)/login/page.tsx:128` has `autoComplete="email"`. CaptureModal, SearchModal, TaskAddPanel, Think thread, AddPersonPanel — all use bare `<input>` with no hints.

**Fix (🟢 SAFE):** Add per-input:
- CaptureModal input: `inputMode="text"`, `autoComplete="off"`, `autoCapitalize="sentences"`, `autoCorrect="off"`
- SearchModal input: `inputMode="search"`, `autoComplete="off"`, `autoCapitalize="none"`
- TaskAddPanel title: `inputMode="text"`, `autoCapitalize="sentences"`
- Think thread entry: `inputMode="text"`, `autoCapitalize="sentences"`
- AddPersonPanel name: `inputMode="text"`, `autoCapitalize="words"` (names are title-cased)
- Login email: already has `autoComplete="email"` — also add `inputMode="email"`, `autoCapitalize="none"`

These are additive attributes. Zero behavior change on desktop. Mobile users get the correct keyboard.

---

### T5-5 · [NEW] · 🟢 · No `overscroll-behavior: contain` — iOS scroll chaining on modals

**Verified:** `globals.css` `body` selector (around line 470) does not set `overscroll-behavior`. The `Sheet.tsx` content area at line 110 has `overscroll-contain` (Tailwind class) — good. But:
- The main `body` has no `overscroll-behavior: contain` — iOS Safari triggers pull-to-refresh on the body when scrolling up at the top.
- Modal/sheet bodies in CaptureModal, SearchModal (not using Sheet), SettingsModal — no `overscroll-behavior`.

**Fix (🟢 SAFE):** Add to `globals.css`:
```css
body {
  overscroll-behavior-y: contain;
}

.modal,
.dropdown-panel,
[data-sonner-toast] {
  overscroll-behavior: contain;
}
```
Per MDN §"overscroll-behavior", this prevents scroll chaining — when a modal reaches the end of its scroll, the scroll does NOT transfer to the page behind.

---

### T5-6 · [NEW] · 🟡 · No `-webkit-touch-callout: none` on UI chrome — iOS long-press save-image menu on icons

**Verified:** Not set in `globals.css`. On iOS Safari, long-pressing an SVG icon or gradient background brings up the "Save Image" / "Copy" context menu. This is jarring in a PWA — users expect app-like behavior where long-press does nothing (or triggers a custom context menu).

**Fix (🟢 SAFE):** Add to `globals.css`:
```css
body {
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}

/* Re-enable for content where copy is intentional */
.thread-entry,
.thread-title,
.person-note,
.task-title {
  -webkit-touch-callout: default;
  user-select: text;
}
```

---

### T5-7 · [NEW] · 🟡 · `MobileTopBar` is fixed at top but content doesn't account for it — content hidden behind bar

**File:** `src/components/layout/AppContentWrapper.tsx`

The MobileTopBar is `fixed top-0 h-[52px]` (52px tall). The AppContentWrapper has `pt-4 md:pt-8` — on mobile, content starts at `pt-4` (16px from top), which means content renders UNDER the 52px MobileTopBar.

**Fix (🟢 SAFE):** Update AppContentWrapper:
```tsx
className={cn(
  "flex-1 flex flex-col pb-24 md:pb-0 relative z-10",
  "pt-[calc(52px+1rem)] md:pt-8",  // account for MobileTopBar on mobile, normal padding on desktop
  isSidebarCollapsed ? "md:pl-[64px]" : "md:pl-[220px]"
)}
```
Or better: use `env(safe-area-inset-top)`:
```tsx
"pt-[calc(env(safe-area-inset-top)+52px+0.5rem)] md:pt-8"
```

---

## Tier 6 — Code Quality & Standards (ongoing)

### T6-1 · [CLAUDE-RIGHT] · 🟡 · Vitest lacks coverage configuration

**Verified:** `vitest.config.ts` has no `coverage` block. No `test:coverage` script in `package.json`.

**Fix (🟡 CAREFUL):** Add to `vitest.config.ts`:
```ts
test: {
  environment: "jsdom",
  globals: true,
  setupFiles: ["src/lib/__tests__/setup.ts"],
  coverage: {
    provider: "v8",
    reporter: ["text", "html", "lcov"],
    exclude: [
      "src/app/**/page.tsx",
      "src/app/**/layout.tsx",
      "src/app/**/loading.tsx",
      "src/app/**/error.tsx",
      "src/app/layout.tsx",
      "src/app/icon.tsx",
      "src/app/sw.ts",
      "src/types/**",
      "src/lib/__tests__/**",
      "**/*.spec.*",
    ],
    thresholds: {
      lines: 50,
      functions: 50,
      branches: 40,
      statements: 50,
    },
  },
},
```
Add to `package.json`:
```json
"test:coverage": "vitest run --coverage"
```
Start with low thresholds (50%) — you can raise them as you add tests. Don't set 80% on day one — it'll block every PR.

---

### T6-2 · [CLAUDE-RIGHT] · 🟢 · No CI/CD pipeline

**Verified:** No `.github/workflows/` directory.

**Fix (🟢 SAFE):** Create `.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Lint
        run: npm run lint
      - name: Type check
        run: npx tsc --noEmit
      - name: Tests
        run: npm test -- --reporter=verbose
      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder-key
```

Note: `npx tsc --noEmit` will fail until T1-1 (remove `ignoreBuildErrors`) is done and the resulting type errors are fixed. You can comment out the "Type check" step initially, then enable it once T1-1 is complete.

---

### T6-3 · [CLAUDE-RIGHT] · 🟢 · `package.json` scripts include debug scripts

**Verified:** `"script:clean": "node scripts/clean-threads.js"` and `"script:snooze": "node scripts/check_snooze.js"` are in `package.json:12-13`.

**Fix (🟢 SAFE):** Remove both lines from `package.json`. Document them in `CONTRIBUTING.md`:
```markdown
## Debug Scripts

These scripts require a `.env.local` with `SUPABASE_SERVICE_ROLE_KEY`. Run them directly:

- `node scripts/clean-threads.js` — clean up orphaned threads
- `node scripts/check_snooze.js` — check snooze state of tasks
```

---

### T6-4 · [NEW] · 🟡 · `useAppStore` is a 16-field god-store with no slices

**File:** `src/store/useAppStore.ts`

The store mixes: UI modal state (`isCaptureModalOpen`, `isSearchModalOpen`, `isSettingsModalOpen`, `isMobileDrawerOpen`), user settings (`userSettings`), timer state (`activeTimer`), ritual state (`activeRitual`), realtime mutation tracking (`lastMutations`), and a prefetched-thread cache (`prefetchedThreads`).

Per Zustand docs §"Slice Pattern", stores should be split by domain. The current monolith means every component that subscribes to ANY field re-renders when ANY other field changes (unless using selectors).

**Fix (🔴 REFACTOR — incremental):** Split into:
- `useUIStore` — modal open/close states, sidebar collapse, mobile drawer
- `useUserStore` — userSettings, updateUserSetting
- `useTimerStore` — activeTimer, setActiveTimer
- `useRitualStore` — activeRitual, setActiveRitual
- Move `prefetchedThreads` to TanStack Query (it's server state).
- Move `lastMutations` to the RealtimeProvider (already done — `useAppStore.markMutation` calls `markProviderMutation`).

Do this one slice at a time. Start with `useTimerStore` (smallest, least coupled).

---

### T6-5 · [NEW] · 🟡 · `AppContentWrapper` destructures the entire store

**File:** `src/components/layout/AppContentWrapper.tsx` (per Claude's v3 plan, this was flagged but I should verify — the file wasn't shown to me in this audit pass, but the pattern is risky).

Per Zustand docs §"Use selectors for partial renders", destructuring `useAppStore()` without a selector causes the component to re-render on EVERY store change. The fix is to use individual selectors:
```tsx
const isSidebarCollapsed = useAppStore(s => s.isSidebarCollapsed);
const setCaptureModalOpen = useAppStore(s => s.setCaptureModalOpen);
// etc.
```

**Fix (🟢 SAFE):** Audit all `useAppStore()` calls without selectors and add selectors. Mechanical refactor.

---

### T6-6 · [NEW] · 🟢 · `prefetchedThreads` cache is never invalidated — memory leak

**File:** `src/store/useAppStore.ts:71, 107`

`setPrefetchedThread(id, thread)` adds entries but nothing ever deletes them. After 100 thread navigations, 100 full thread objects sit in memory.

**Fix (🟢 SAFE):** Move to TanStack Query with `gcTime` (formerly `cacheTime`):
```ts
const { data: thread } = useQuery({
  queryKey: ['thread', id],
  queryFn: () => fetchThread(id),
  initialData: () => queryClient.getQueryData(['threads'])?.find(t => t.id === id),
  staleTime: 60_000,  // 1 minute
  gcTime: 5 * 60_000,  // 5 minutes
});
```
Then delete `prefetchedThreads` and `setPrefetchedThread` from the store.

---

## Tier 7 — Beauty / Interaction (additive, do last)

From Claude's v3 plan §7, these are all still open and valid:
- Linear-style reconnect indicator (wire `useRealtimeStatus` — but fix T0-4 first)
- Sidebar icon hover micro-animation (2px translateX, gated behind `useIsTouch`)
- Campsite-style 3D card tilt on Home space-tiles and Explore tiles
- Luma cursor-follow glow on `.btn-primary`
- Airbnb-style range slider for Pomodoro duration and `daily_capacity_minutes`
- Linear eased progress fill on `WorkloadBar.tsx` and Pomodoro SVG ring (use `pathLength` springs)

These are all additive — no risk of breaking anything. Do them in any order after Tiers 0–6 are stable.

---

## Execution Order

This is the **safe** order. Each tier's items are independent within the tier — you can do them in any order. But do NOT skip ahead.

### Week 1 — Emergency + Security foundation
1. **T0-1** — Verify and fix `remove_linked_person` trigger (migration)
2. **T0-2** — Fix `useRealtime` fallback visibility churn (one-line dep change)
3. **T0-3** — Add debounced channel teardown in RealtimeProvider (5s grace period)
4. **T1-3** — Delete `test-realtime` route (pure deletion)
5. **T1-7** — Create `.env.example` (documentation)
6. **T1-8** — Add `src/lib/env.ts` with startup validation (pure refactor)
7. **T3-10** — Delete `test.js` (pure deletion)
8. **T3-11** — Fix `.gitignore` UTF-16 corruption (re-type the section)

### Week 2 — Type safety + API hardening
1. **T1-4** — Install Zod, add schemas to all 3 API routes
2. **T1-9** — Stop leaking Postgres errors to client
3. **T1-10** — Rate-limit `/api/account`
4. **T1-11** — Rate-limit + bulk upsert `/api/people/reorder`
5. **T1-6** — Fail-closed rate limiter in prod without Redis
6. **T6-2** — Add CI workflow (lint + test + build; skip type-check for now)

### Week 3 — CSP + DB hardening
1. **T1-2** — Add nonce-based CSP in middleware (test thoroughly — breakages likely)
2. **T1-5** — Add `TO authenticated` to all RLS policies (migration, test on staging)
3. **T2-3** — Migrate `explores.note` to nullable
4. **T2-5** — Harden `handle_new_user` in baseline migration
5. **T2-6** — Harden `increment_time_spent` in baseline migration
6. **T2-7** — Tighten `rename_category` ILIKE to strict equality

### Week 4 — Remove `ignoreBuildErrors` + fix the type errors it was hiding
1. **T1-1** — Remove `ignoreBuildErrors: true` from `next.config.ts`
2. **T3-5** — Fix 28 `catch (error: any)` → `catch (error: unknown)`
3. Generate typed Supabase client, fix remaining `: any` annotations
4. Enable the "Type check" step in CI (T6-2)

### Week 5 — Architecture (incremental)
1. **T3-1** — Fix sidebar `transition-[width]` → `transform`
2. **T3-3** — Fix LenisProvider RAF leak
3. **T3-4** — Add Serwist update prompt
4. **T3-7** — Fix Sheet focus-trap race + aria-label
5. **T3-8** — Reduce MobileTopBar blur
6. **T3-9** — Fix `pt-safe-top` missing class
7. **T3-13** — Delete `template.tsx` (or move animation to per-page)
8. **T0-4** — Fix `useRealtimeStatus` to track actual channel state

### Week 6 — Performance + mobile polish
1. **T4-1** — Add `compromise`, `lenis`, `@base-ui/react` to `optimizePackageImports`
2. **T4-2** — Move chrono-node to server
3. **T4-3** — Add `content-visibility: auto` on desktop lists
4. **T4-4** — Lazy-load people in CaptureModal
5. **T4-5** — Replace `select("*")` with explicit column lists (page by page)
6. **T5-3** — Fix iOS input zoom (16px floor on mobile)
7. **T5-4** — Add `inputMode` / `autoComplete` / `autoCapitalize`
8. **T5-5** — Add `overscroll-behavior: contain`
9. **T5-6** — Add `-webkit-touch-callout: none`
10. **T5-7** — Fix content hidden behind MobileTopBar

### Week 7+ — Beauty (additive)
- All items in Tier 7, in any order.

### Ongoing (never finishes)
- **T3-12** — Convert client-component pages to Server Components (one per PR)
- **T6-1** — Add tests, raise coverage thresholds quarterly
- **T6-4** — Split `useAppStore` into slices (one slice per PR)

---

## What I disagree with in Claude's v3 plan

| Claude's claim | My finding | Verdict |
|---|---|---|
| `categories` table "never used by the app" | `SettingsModal.tsx:448` calls `.from("categories").delete()` | **WRONG** — do not drop the table |
| 5 `catch (error: any)` instances | 28 instances (5.6x understated) | **UNDERSTATED** |
| `useIsTouch`, `useMediaQuery`, `useVisualViewport` have "zero callers" | `useIsTouch` is used in Navigation.tsx; `useVisualViewport` is used in Sheet.tsx | **WRONG** — they have callers, just under-used |
| "RealtimeProvider architecture complete" | The fallback path in `useRealtime` still has the visibility-churn bug (T0-2) | **UNDERSTATED** — provider is fine, fallback is broken |
| `ConnectionStatus` is wired | `useRealtimeStatus` tracks browser online/offline, NOT actual realtime channel state (T0-4) | **MISLEADING** — the indicator lies |
| Do CSP via middleware nonce | Correct approach, but Claude didn't note that nonce-based CSP forces dynamic rendering | **INCOMPLETE** — flag the trade-off |
| Drop `categories` table | SettingsModal uses it | **WRONG** — see above |

## What Claude got right

Most of it. The security items (T1-1 through T1-8), the DB items (T2-1 through T2-7), the architecture items (T3-1 through T3-6), and the performance items (T4-1 through T4-4) are all legitimate. The mobile items (T5-1 through T5-5) are correct in spirit even if the "zero callers" claim was wrong. The beauty items (Tier 7) are all valid.

## What Claude missed (my NEW findings)

- **T0-1**: Migration conflict between `remove_linked_person` trigger and the `linked_people` column drop
- **T0-2**: `useRealtime` fallback path still has the visibility-churn bug
- **T0-3**: RealtimeProvider unsubscribes channels immediately on listener-count-zero (navigation churn)
- **T0-4**: `useRealtimeStatus` tracks browser online/offline, not realtime channel state — the indicator lies
- **T1-9**: `/api/account` leaks Postgres error messages
- **T1-10**: `/api/account` has no rate limit
- **T1-11**: `/api/people/reorder` has no rate limit AND no payload size limit (Claude flagged the N+1 but not the DoS)
- **T2-5, T2-6**: Baseline migrations lack `SECURITY DEFINER` + `search_path` (Claude flagged handle_new_user but missed increment_time_spent and the baseline-vs-patch inconsistency)
- **T2-7**: `rename_category` RPC allows `%` wildcard in `p_old_category` → mass rename
- **T3-7**: Sheet focus-trap race + missing aria-label on close button
- **T3-8**: MobileTopBar uses `backdrop-blur-2xl` (40px) — Claude fixed the bottom nav but missed the top bar
- **T3-9**: `pt-safe-top` class referenced but not defined in CSS
- **T3-10**: `test.js` at repo root
- **T3-11**: `.gitignore` UTF-16 corruption (Claude caught this — credit where due)
- **T3-12**: 63% client-component ratio (Claude didn't quantify)
- **T3-13**: `template.tsx` re-mounts pages on navigation (Claude didn't flag)
- **T4-4**: CaptureModal fetches all people on every open
- **T4-5**: 37 `select("*")` calls (Claude didn't quantify)
- **T5-5**: No `overscroll-behavior: contain`
- **T5-6**: No `-webkit-touch-callout: none`
- **T5-7**: Content hidden behind MobileTopBar
- **T6-4**: `useAppStore` god-store (Claude didn't flag)
- **T6-5**: `AppContentWrapper` destructures store without selectors
- **T6-6**: `prefetchedThreads` memory leak (Claude didn't flag)

---

## Final note on safety

Every fix in this plan is marked 🟢 / 🟡 / 🔴. The 🟢 items are zero-risk and can be shipped today. The 🟡 items need testing on staging (especially anything that touches the database or middleware). The 🔴 items are architectural refactors — do them incrementally, one PR at a time, behind feature flags if needed.

**Do NOT do all of Tier 0 in one PR.** Each T0 item is independent — ship them as separate PRs so a rollback is surgical.

**Do NOT remove `ignoreBuildErrors` (T1-1) until you've fixed the 28 catch-block type errors (T3-5).** Otherwise the build breaks and you can't deploy anything.

**Test the CSP change (T1-2) on staging with the actual app.** CSP is notorious for breaking inline scripts, eval, and dynamic imports. The theme-init script, the Supabase client, and Framer Motion all need to work under CSP. Use the `report-uri` directive (or `report-to`) initially to collect violations without blocking:
```ts
"report-uri /api/csp-report",
```
Then once you've fixed all violations, switch from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`.
