import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";

import "./globals.css";
import { headers } from "next/headers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Presense",
  description:
    "Presense is a personal productivity web app that captures tasks, thoughts, and memories — and surfaces them back to you at the right moment.",
  keywords: ["productivity", "second brain", "tasks", "notes", "capture"],
  icons: {
    icon: "/icon.svg",
  },
  manifest: "/manifest.json",
};

import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

import { ToastProvider } from "@/components/ui/ToastProvider";
import { WebVitalsReporter } from "@/components/layout/WebVitalsReporter";
import { cn } from "@/lib/utils";
import { env } from "@/lib/env";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const nonce = headersList.get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        inter.variable,
        jetbrainsMono.variable,
        newsreader.variable,
        "font-sans",
      )}
    >
      <head>
        <link
          rel="preconnect"
          href={env.NEXT_PUBLIC_SUPABASE_URL}
          crossOrigin="anonymous"
        />
        <noscript>
          <style>{`
            .no-js-fallback {
              position: fixed; top: 0; left: 0; right: 0; bottom: 0;
              background: #141118; color: #f4ede4; z-index: 9999;
              display: flex; align-items: center; justify-content: center;
              font-family: sans-serif;
            }
          `}</style>
          <div className="no-js-fallback">
            Presense requires JavaScript to run. Please enable it in your
            browser settings.
          </div>
        </noscript>
        <script
          id="theme-init"
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var html = document.documentElement;
                var isLogin = window.location.pathname.startsWith('/login');
                var rawTheme = isLogin ? 'warm' : (localStorage.getItem('presense_theme') || 'warm');
                var theme = (rawTheme === 'orange' || rawTheme === 'wahala' || rawTheme === 'sunset') ? 'warm' : 
                            (rawTheme === 'blue' || rawTheme === 'midnight' || rawTheme === 'navy') ? 'navy' :
                            (rawTheme === 'forest' || rawTheme === 'meadow') ? 'forest' : rawTheme;
                var mode = isLogin ? 'dark' : (localStorage.getItem('presense_color_mode') || 'dark');
                var reduceMotion = localStorage.getItem('presense_reduce_motion') === 'true';
                var isLight = mode === 'light' || (mode === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches);
                var resolvedMode = isLight ? 'light' : 'dark';
                var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
                var defaultDensity = isTouch ? 'comfortable' : 'compact';
                var density = localStorage.getItem('presense_density') || defaultDensity;
                
                html.classList.remove('theme-blue', 'theme-forest', 'theme-navy', 'theme-midnight', 'theme-meadow', 'light');
                html.setAttribute('data-theme', theme);
                html.setAttribute('data-mode', resolvedMode);
                html.setAttribute('data-density', density);
                
                if (reduceMotion) {
                  html.classList.add('reduce-motion');
                } else {
                  html.classList.remove('reduce-motion');
                }
                
                var metaTheme = document.createElement('meta');
                metaTheme.name = 'theme-color';
                metaTheme.content = isLight ? '#f7f2ec' : '#141118'; // = THEME_COLOR in lib/theme.ts
                document.head.appendChild(metaTheme);
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-[var(--color-background)] text-[var(--color-text-2)] transition-colors duration-300">
        <WebVitalsReporter />
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
