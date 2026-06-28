## Challenge Summary

**Overall risk assessment**: MEDIUM

Next.js Edge Auth Middleware implements a standard Supabase SSR cookie-handling and redirection logic. However, several adversarial and edge routing scenarios reveal potential weaknesses:
1. **Case-Sensitivity Vulnerability**: The route checks for `/login` and `/auth` are case-sensitive. Authenticated users accessing `/LOGIN` or `/Login` are not redirected to the home page, bypass the auth check, and are allowed to pass (leading to potential routing inconsistencies).
2. **Robustness Vulnerability**: The middleware lacks exception handling around `supabase.auth.getUser()`. If the Supabase SDK throws a runtime error (e.g. from corrupt cookie parsing or critical client errors), it will crash the request with a HTTP 500 error instead of failing gracefully.
3. **API Authorization Limitations**: The middleware does not check or verify the `Authorization: Bearer <token>` header, meaning client apps relying on headers rather than cookies will be redirected to `/login` unless explicitly excluded in the matcher.

---

## Challenges

### [Medium] Challenge 1: Case-Sensitive Auth Route Matching

- **Assumption challenged**: Request pathnames checking for authentication routes (`/login` and `/auth`) are always lowercase.
- **Attack scenario**: An authenticated user requests `/LOGIN` or `/Login`. The middleware evaluates `isAuthRoute` as `false` because `startsWith('/login')` is case-sensitive. The user is allowed to proceed to `/LOGIN` instead of being redirected to `/`.
- **Blast radius**: Bypassing standard routing rules. Depending on downstream configurations, this could lead to duplicate page loads, route confusion, or SEO duplicate content issues.
- **Mitigation**: Normalize pathname to lowercase before performing the match:
  ```typescript
  const pathname = request.nextUrl.pathname.toLowerCase();
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/auth');
  ```

### [Medium] Challenge 2: Unhandled Exceptions in `getUser()`

- **Assumption challenged**: `supabase.auth.getUser()` is safe and never throws synchronous or asynchronous rejections.
- **Attack scenario**: A corrupted cookie, database timeout, or library-level exception causes `getUser()` to throw an error. Because there is no `try...catch` block, the exception propagates, resulting in a server crash (500 Internal Server Error) for the client.
- **Blast radius**: Service denial for all protected pages.
- **Mitigation**: Wrap the `getUser()` check in a `try...catch` block:
  ```typescript
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (error) {
    console.error("Auth middleware error:", error);
    // Safe fallback: treat as unauthenticated
  }
  ```

### [Low] Challenge 3: Lack of Authorization Header Parsing

- **Assumption challenged**: All clients requesting protected routes are browsers storing authentication state in cookies.
- **Attack scenario**: An API client or mobile app attempts to request a protected route with an `Authorization: Bearer <token>` header but without cookies. The middleware ignores the header, checks cookies, returns `user: null`, and redirects the API client to `/login` with a 307 temporary redirect.
- **Blast radius**: API clients receive HTML redirects instead of standard 401 Unauthorized responses.
- **Mitigation**: Add a check for the `Authorization` header in the middleware, or ensure that API routes requiring token-based authentication are excluded in the middleware's `matcher` configuration.

---

## Stress Test Results

| Test Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|
| **Missing Cookies** | Redirect to `/login` with `307` | Redirected to `/login` with `307` | **PASS** |
| **Auth Header Only (No Cookies)** | Redirect to `/login` with `307` | Redirected to `/login` with `307` | **PASS** |
| **Malformed Cookie Value** | Redirect to `/login` with `307` | Redirected to `/login` with `307` | **PASS** |
| **Exception in `getUser()`** | Fail gracefully or fallback | Propagates unhandled rejection (500 Error) | **FAIL** |
| **Trailing Slash: Protected path (`/do/`)** | Redirect to `/login` with `307` | Redirected to `/login` with `307` | **PASS** |
| **Trailing Slash: Auth path (`/login/` - Authenticated)** | Redirect to `/` with `307` | Redirected to `/` with `307` | **PASS** |
| **Capital Letters: Protected path (`/DO` - Unauthenticated)** | Redirect to `/login` with `307` | Redirected to `/login` with `307` | **PASS** |
| **Capital Letters: Auth path (`/LOGIN` - Authenticated)** | Redirect to `/` with `307` | Returns `NextResponse.next()` (no redirect) | **FAIL** |
| **Query Params: Protected path (`/do?param=1`)** | Redirect to `/login?param=1` with `307` | Redirected to `/login?param=1` with `307` | **PASS** |
| **Query Params: Auth path (`/login?param=1` - Authenticated)** | Redirect to `/?param=1` with `307` | Redirected to `/?param=1` with `307` | **PASS** |
| **Cookie Forwarding on Redirect** | Copied Supabase refreshed cookies to response | Cookies successfully copied | **PASS** |
| **Redirect Loop: Unauthenticated `/login`** | Allow access (no redirect) | Allowed (returns `NextResponse.next()`) | **PASS** |
| **Redirect Loop: Authenticated `/`** | Allow access (no redirect) | Allowed (returns `NextResponse.next()`) | **PASS** |

---

## Unchallenged Areas

- **Matcher Exclusions** — The regex configurations in the `matcher` array (e.g. static assets, images, favicon) were not exhaustively checked against all possible filename extensions due to focus on edge routing logic.
- **Supabase Session Refresh Token Validity** — We mock the cookie-setting function but do not hit the live Supabase API endpoints to test refresh token validity, as we are operating in `CODE_ONLY` network mode.
