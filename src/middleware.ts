import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // CSP nonce
  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV === 'development';
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
  const cspHeader = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${env.NEXT_PUBLIC_SUPABASE_URL}`,
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

  supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Re-set cookies on the new response
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    supabaseResponse.cookies.set(cookie.name, cookie.value, cookie);
  });

  supabaseResponse.headers.set('Content-Security-Policy', cspHeader);

  try {
    const { data: { user } } = await supabase.auth.getUser();

    const isAuthRoute = request.nextUrl.pathname.toLowerCase().startsWith('/login') ||
                        request.nextUrl.pathname.toLowerCase().startsWith('/auth');

    // Redirect unauthenticated users to login
    if (!user && !isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      const response = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        const { name, value, ...options } = cookie;
        response.cookies.set(name, value, options);
      });
      response.headers.set('Content-Security-Policy', cspHeader);
      return response;
    }

    // Redirect authenticated users away from login page
    if (user && isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      const response = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        const { name, value, ...options } = cookie;
        response.cookies.set(name, value, options);
      });
      response.headers.set('Content-Security-Policy', cspHeader);
      return response;
    }
  } catch (error) {
    console.error("Middleware auth check failed:", error);
    
    const isLoginRoute = request.nextUrl.pathname.toLowerCase().startsWith('/login');
    if (!isLoginRoute) {
      try {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        const response = NextResponse.redirect(url);
        supabaseResponse.cookies.getAll().forEach((cookie) => {
          const { name, value, ...options } = cookie;
          response.cookies.set(name, value, options);
        });
        response.headers.set('Content-Security-Policy', cspHeader);
        return response;
      } catch (redirectError) {
        console.error("Failed to redirect to login in middleware error handler:", redirectError);
        return supabaseResponse;
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
