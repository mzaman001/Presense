import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';
  const scriptSrc = isDev 
    ? `'self' 'unsafe-inline' 'unsafe-eval'` 
    : `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`;
    
  const cspHeader = `
    default-src 'self';
    script-src ${scriptSrc};
    style-src 'self' 'unsafe-inline';
    connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com https://www.googleapis.com;
    img-src 'self' blob: data: https://*.supabase.co;
    font-src 'self' data:;
    object-src 'none';
    base-uri 'self';
    form-action 'self' https://accounts.google.com https://*.supabase.co;
    frame-src 'self' https://accounts.google.com;
  `.replace(/\s{2,}/g, ' ').trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  supabaseResponse.headers.set('Content-Security-Policy', cspHeader);
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  try {
    const { data: { user } } = await supabase.auth.getUser();

    const isAuthRoute = request.nextUrl.pathname.toLowerCase().startsWith('/login') ||
                        request.nextUrl.pathname.toLowerCase().startsWith('/auth');
    const isTestRoute = request.nextUrl.pathname.toLowerCase().startsWith('/test-');

    // Redirect unauthenticated users to login
    if (!user && !isAuthRoute && !isTestRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      const response = NextResponse.redirect(url);
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        const { name, value, ...options } = cookie;
        response.cookies.set(name, value, options);
      });
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
      return response;
    }
  } catch (error) {
    console.error("Middleware auth check failed:", error);
    
    // In case of error, default to returning the original response or redirecting the user to /login
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
