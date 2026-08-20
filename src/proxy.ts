import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<
    ReturnType<typeof NextResponse.next>["cookies"]["set"]
  >[2];
};

const sentryDsnRe = /^https:\/\/([^@]+)@o(\d+)\.(ingest\.[^/]+)\/(\d+)$/;

// Verbatim derivation of Sentry's ingest host from the DSN (host part only).
// Returns "" when the DSN is absent or malformed so the CSP stays byte-identical.
export function cspSentryIngestOrigin(dsn: string | null | undefined): string {
  if (!dsn) return "";
  const match = sentryDsnRe.exec(dsn);
  if (!match) return "";
  const [, , orgId, ingestHost] = match;
  return `https://o${orgId}.${ingestHost}`;
}

// Verbatim derivation of Sentry's CSP violation reporting endpoint from the DSN.
// Returns "" when the DSN is absent or malformed so the CSP stays byte-identical.
export function cspReportUri(dsn: string | null | undefined): string {
  if (!dsn) return "";
  const match = sentryDsnRe.exec(dsn);
  if (!match) return "";
  const [, key, orgId, ingestHost, projectId] = match;
  return `https://o${orgId}.${ingestHost}/api/${projectId}/security/?sentry_key=${key}`;
}

function buildCspHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;

  const reportUri = cspReportUri(env.NEXT_PUBLIC_SENTRY_DSN);

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${env.NEXT_PUBLIC_SUPABASE_URL}`,
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co " +
      cspSentryIngestOrigin(env.NEXT_PUBLIC_SENTRY_DSN),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
    ...(reportUri ? [`report-uri ${reportUri}`] : []),
  ].join("; ");
}

function applyCookies(response: NextResponse, cookiesToSet: CookieToSet[]) {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
}

function securedNextResponse(
  requestHeaders: Headers,
  cspHeader: string,
  cookiesToSet: CookieToSet[],
) {
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", cspHeader);
  applyCookies(response, cookiesToSet);
  return response;
}

function securedRedirectResponse(
  request: NextRequest,
  pathname: string,
  cspHeader: string,
  cookiesToSet: CookieToSet[],
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const response = NextResponse.redirect(url);
  response.headers.set("Content-Security-Policy", cspHeader);
  applyCookies(response, cookiesToSet);
  return response;
}

export async function proxy(request: NextRequest) {
  const nonce = generateNonce();
  const cspHeader = buildCspHeader(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  let cookiesToSet: CookieToSet[] = [];
  let supabaseResponse = securedNextResponse(
    requestHeaders,
    cspHeader,
    cookiesToSet,
  );

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(newCookies) {
          newCookies.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          cookiesToSet = newCookies;
          supabaseResponse = securedNextResponse(
            requestHeaders,
            cspHeader,
            cookiesToSet,
          );
        },
      },
    },
  );

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname.toLowerCase();
    const isAuthRoute =
      pathname.startsWith("/login") || pathname.startsWith("/auth");

    if (!user && !isAuthRoute) {
      /* AUDIT-02 (Aug 19, 2026): programmatic consumers of /api/* routes
         (capture bot, future mobile) received an HTML 307 to /login, which
         most HTTP clients handle uselessly. API routes now get a JSON 401
         with a stable error code; page routes keep the HTML redirect. The
         CSP header and cookie propagation (Law 6 invariants) are untouched. */
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          {
            error: "Unauthorized",
            code: "AUTH_REQUIRED",
            message: "A valid session cookie is required.",
          },
          { status: 401 },
        );
      }
      return securedRedirectResponse(
        request,
        "/login",
        cspHeader,
        cookiesToSet,
      );
    }

    if (user && isAuthRoute) {
      return securedRedirectResponse(request, "/", cspHeader, cookiesToSet);
    }
  } catch (error) {
    console.error("Proxy auth check failed:", error);

    const isLoginRoute = request.nextUrl.pathname
      .toLowerCase()
      .startsWith("/login");
    if (!isLoginRoute) {
      try {
        return securedRedirectResponse(
          request,
          "/login",
          cspHeader,
          cookiesToSet,
        );
      } catch (redirectError) {
        console.error(
          "Failed to redirect to login in proxy error handler:",
          redirectError,
        );
        return supabaseResponse;
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
