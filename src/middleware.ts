import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

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
