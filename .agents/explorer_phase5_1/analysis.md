# Phase 5 Investigation Report: Supabase Database Schema, Auth Logic, and Middleware

## Executive Summary
This report analyzes the Supabase database schema for core entities (`items`, `threads`, `people`), the current client-server authentication structure, and specifies the exact Next.js Edge Auth Middleware design using `@supabase/ssr`. Additionally, it highlights a common redirect cookie-loss issue and provides a complete testing strategy with test code snippets.

---

## 1. Database Schema & RLS Configuration

The database schema is constructed via sequential migrations in the `supabase/migrations/` directory.

### A. Core Tables Detail

#### I. `items` Table (Do Space)
Represents user tasks, habits, and items in the queue.
- **Schema Details**:
  - `id`: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id`: `uuid REFERENCES auth.users NOT NULL` (enforces user boundaries)
  - `title`: `text NOT NULL`
  - `first_step`: `text` (immediate action step)
  - `ifthen_trigger`: `text` (behavioral cue trigger)
  - `notes`: `text`
  - `deadline`: `timestamptz`
  - `start_date`: `timestamptz`
  - `status`: `text DEFAULT 'active'` with check constraint `CHECK (status IN ('active', 'done', 'overdue', 'archived', 'inbox', 'deleted'))` (as amended in migration `005`)
  - `category`: `text DEFAULT 'other'`
  - `priority`: `int DEFAULT 4`
  - `subtasks`: `jsonb[] DEFAULT '{}'`
  - `recurrence`: `text` (RRULE recurrence string)
  - `snoozed_until`: `timestamptz`
  - `notification_sent_72h` / `_24h` / `_6h` / `_1h` / `_overdue`: `boolean DEFAULT false`
  - `completed_at`: `timestamptz`
  - `deleted_at`: `timestamptz`
  - `created_at`: `timestamptz DEFAULT now()`
  - `linked_people_ids`: `uuid[] DEFAULT '{}'` (added in migration `002_add_linked_people.sql` to link tasks to People entries)
  - `time_spent_minutes`: `int DEFAULT 0` (originally added as `pomodoros_count` in migration `006`, then renamed to `time_spent_minutes` and updated via trigger on `session_logs` in migration `007`)
  - `time_estimate`: `integer DEFAULT 0` (added in migration `010`)
- **Indexes**:
  - `idx_items_title` (GIN pg_trgm index for text search)
  - `idx_items_first_step` (GIN pg_trgm index)
  - `idx_items_user_status` on `(user_id, status)`
  - `idx_items_deadline` on `(deadline)`
- **Row Level Security (RLS)**:
  - Enabled. Policy `"users_own_items"` enforces `auth.uid() = user_id` for SELECT/INSERT/UPDATE/DELETE.

#### II. `people` Table (Remember Space)
Manages contacts and relationship dynamics.
- **Schema Details**:
  - `id`: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id`: `uuid REFERENCES auth.users NOT NULL`
  - `name`: `text NOT NULL`
  - `relationship`: `text DEFAULT 'other'` (categories managed via settings)
  - `initials`: `text` (avatar backup initials)
  - `color`: `text DEFAULT '#E5B41E'`
  - `notes`: `jsonb[] DEFAULT '{}'` (stores historical interaction entries)
  - `sort_order`: `int DEFAULT 0`
  - `last_seen`: `timestamptz`
  - `next_meeting`: `timestamptz`
  - `created_at`: `timestamptz DEFAULT now()`
- **Indexes**:
  - `idx_people_name` (GIN pg_trgm index)
  - `idx_people_meeting` on `(user_id, next_meeting)`
- **Row Level Security (RLS)**:
  - Enabled. Policy `"users_own_people"` enforces `auth.uid() = user_id` for all operations.

#### III. `threads` Table (Think Space)
Manages thoughts, daily notes, and journals.
- **Schema Details**:
  - `id`: `uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id`: `uuid REFERENCES auth.users NOT NULL`
  - `title`: `text NOT NULL` (frequently represents dates or subjects)
  - `color_accent`: `text DEFAULT '#2DD4BF'`
  - `entries`: `jsonb[] DEFAULT '{}'` (chronological log of thought entries)
  - `status`: `text DEFAULT 'active'` with check constraint `CHECK (status IN ('active', 'archived', 'deleted'))`
  - `is_pinned`: `boolean DEFAULT false`
  - `stale_prompt`: `text`
  - `stale_prompt_at`: `timestamptz`
  - `last_updated`: `timestamptz DEFAULT now()`
  - `deleted_at`: `timestamptz`
  - `created_at`: `timestamptz DEFAULT now()`
- **Constraints & Indexes**:
  - Unique partial index: `idx_threads_user_title_unique` ON `threads(user_id, title) WHERE status != 'deleted'` (migration `002_unique_thread_constraint.sql`) preventing race conditions that create duplicate daily notes.
  - `idx_threads_title` (GIN pg_trgm index)
  - `idx_threads_updated` on `(user_id, last_updated DESC)`
- **Row Level Security (RLS)**:
  - Enabled. Policy `"users_own_threads"` enforces `auth.uid() = user_id`.

---

## 2. Authentication Logic & Cookie Structure

### A. Current Auth Flow
Presense supports passwordless magic links (OTP) and Google OAuth:
1. **Sign-In Initiated**:
   - Done in `src/app/(auth)/login/page.tsx` using a browser-side client created by `createBrowserClient` from `@supabase/ssr` (defined in `src/lib/supabase.ts`).
   - Users trigger `signInWithOtp` (sending `email`) or `signInWithOAuth` (using Google provider).
   - Redirect URI is pointed to `${window.location.origin}/auth/callback`.
2. **Authorization Code Exchange**:
   - Executed inside the Route Handler `src/app/auth/callback/route.ts`.
   - The handler extracts the `code` query parameter, invokes the server client (`src/lib/supabase-server.ts`) which wraps `createServerClient`, and calls `exchangeCodeForSession(code)`.
   - On success, it redirects to `/onboarding`.

### B. Cookie Management Architecture
- **Structure**: Supabase sets multiple cookies on the domain (e.g., `sb-<project-ref>-auth-token` or split-chunk cookies like `sb-<project-ref>-auth-token.0`, `sb-<project-ref>-auth-token.1`). They contain base64-encoded JWT payloads containing the access token, expiration, refresh token, and user object.
- **Client vs. Server Configurations**:
  - **Browser Client (`src/lib/supabase.ts`)**: Reads cookies directly via browser APIs (`document.cookie`) to authorize client-side queries/mutations.
  - **Server Client (`src/lib/supabase-server.ts`)**: Operates inside Next.js App Router (Server Components/Route Handlers). It reads/writes cookies using the asynchronous Next.js 15+ `cookies()` header function. Note that standard React Server Components cannot write response headers, so `setAll` has a try-catch safety net to prevent errors during read-only rendering.

---

## 3. Next.js Edge Auth Middleware Boilerplate

To enforce page protection securely, Next.js Edge Middleware must handle request and response cookies using `@supabase/ssr`.

### A. The Challenge: Cookie Loss on Redirects
When using `@supabase/ssr` in middleware, if a user's session is expired, calling `getUser()` prompts the client to automatically refresh the session (using the refresh token). This updates the cookies via `setAll`.
If the middleware immediately returns a redirect response (e.g., `NextResponse.redirect(url)`), the cookies set inside `setAll` on the *original* response will be lost unless they are manually copied over. This creates authentication loops.

### B. Complete Edge Middleware Boilerplate (`src/middleware.ts`)

Here is the proposed implementation to write to the project:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // 1. Initialize the base response
  let supabaseResponse = NextResponse.next({
    request,
  });

  // 2. Instantiate Supabase server client bound to request/response cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Update cookies on request so subsequent middleware/handlers can read them
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Re-create the base response with updated request headers
          supabaseResponse = NextResponse.next({
            request,
          });
          // Update cookies on the response headers to send back to the browser
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 3. Retrieve user (using getUser is secure, as it validates the JWT server-side)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = request.nextUrl.clone();
  const path = url.pathname;

  // 4. Define Route Policies
  // Protected paths: landing page (if dashboard), /do, /explore, /inbox, /remember, /think, /onboarding, and /verify-db
  const isProtectedPath =
    path === "/" ||
    path.startsWith("/do") ||
    path.startsWith("/explore") ||
    path.startsWith("/inbox") ||
    path.startsWith("/remember") ||
    path.startsWith("/think") ||
    path.startsWith("/onboarding") ||
    path.startsWith("/verify-db");

  // Auth paths: login screen
  const isAuthPath = path.startsWith("/login");

  // 5. Handle Redirects and sync updated cookies
  if (!user && isProtectedPath) {
    url.pathname = "/login";
    const redirectResponse = NextResponse.redirect(url);
    
    // CRITICAL: Copy cookies from supabaseResponse to the redirect response
    // to prevent losing refreshed session data
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, {
        path: cookie.path,
        domain: cookie.domain,
        maxAge: cookie.maxAge,
        expires: cookie.expires,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
      });
    });
    return redirectResponse;
  }

  if (user && isAuthPath) {
    url.pathname = "/do";
    const redirectResponse = NextResponse.redirect(url);

    // Sync cookies to redirect response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, {
        path: cookie.path,
        domain: cookie.domain,
        maxAge: cookie.maxAge,
        expires: cookie.expires,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
      });
    });
    return redirectResponse;
  }

  return supabaseResponse;
}

// 6. Matcher Configuration to exclude static resources and images
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icon.tsx (icons)
     * - images, vector assets (png, svg, jpg, webp)
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.tsx|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

---

## 4. Testing Strategy

### A. Current Test Inventory & Status
- There are no existing tests verifying route redirects or middleware behavior. Existing files under `src/lib/__tests__/` focus entirely on store integration and components (`phase3.test.tsx`, `phase4.test.tsx`) or domain logic (`capture-router.test.ts`).
- **Pre-existing test execution failures**: Running the test suite (`npm run test`) fails inside `phase4.test.tsx` due to `TypeError: Cannot destructure property 'data' of '(intermediate value)' as it is undefined`. This happens because `supabase.auth.getUser` returns `undefined` by default in the mock setup inside component integration files when not explicitly overridden, which throws an error on component mounts (e.g. `RitualOverlay.tsx:223`). This is a pre-existing environment mock limitation.

### B. Proposing a Middleware Testing Strategy
To test middleware behavior with Vitest, we can write unit/integration tests that:
1. Mock `@supabase/ssr`'s `createServerClient`.
2. Mock `NextRequest` and `NextResponse`.
3. Invoke the `middleware()` function directly with different request paths and authentication states, verifying the returned status codes (e.g. `307` for redirects) and target header values (`location`).

### C. Proposed Test Implementation (`src/lib/__tests__/middleware.test.ts`)

Here is the exact code suggested for testing middleware logic:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { middleware } from "../../middleware";
import { createServerClient } from "@supabase/ssr";

// Mock @supabase/ssr client
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

describe("Edge Auth Middleware Integration Tests", () => {
  let mockGetUser = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock supabase client returned by createServerClient
    (createServerClient as any).mockReturnValue({
      auth: {
        getUser: mockGetUser,
      },
    });
  });

  // Helper to construct NextRequest for testing
  function createMockRequest(urlPath: string, cookies: Record<string, string> = {}) {
    const request = new NextRequest(new URL(`http://localhost:3000${urlPath}`), {
      headers: {
        host: "localhost:3000",
      },
    });

    Object.entries(cookies).forEach(([key, val]) => {
      request.cookies.set(key, val);
    });

    return request;
  }

  describe("Unauthenticated User Checks", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    });

    it("should redirect to /login when accessing protected route /do", async () => {
      const request = createMockRequest("/do");
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/login");
    });

    it("should redirect to /login when accessing protected root path /", async () => {
      const request = createMockRequest("/");
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/login");
    });

    it("should allow access to /login without redirect", async () => {
      const request = createMockRequest("/login");
      const response = await middleware(request);

      // Status should be 200 (NextResponse.next() does not redirect, returns 200 or custom status)
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    });
  });

  describe("Authenticated User Checks", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({
        data: {
          user: { id: "test-user-uuid", email: "user@example.com" },
        },
        error: null,
      });
    });

    it("should allow access to protected page /do without redirect", async () => {
      const request = createMockRequest("/do");
      const response = await middleware(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    });

    it("should redirect from /login to /do for already logged-in users", async () => {
      const request = createMockRequest("/login");
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/do");
    });
  });
});
```
