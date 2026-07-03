import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Geist } from "next/font/google";

import "./globals.css";
import { headers } from "next/headers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Presense — Your External Brain",
  description:
    "Presense is a personal productivity web app that captures tasks, people, thoughts, and memories — and surfaces them back to you at the right moment.",
  keywords: ["productivity", "second brain", "tasks", "notes", "capture"],
  icons: {
    icon: "/icon.svg",
  },
  manifest: "/manifest.json",
};

import type { Viewport } from "next";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

import { ToastProvider } from "@/components/ui/ToastProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConnectionStatus } from "@/components/ui/ConnectionStatus";
import { UpdatePrompt } from "@/components/ui/UpdatePrompt";
import { WebVitalsReporter } from "@/components/layout/WebVitalsReporter";
import { cn } from "@/lib/utils";
import { env } from "@/lib/env";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});


export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning className={cn("h-full", "antialiased", inter.variable, jetbrainsMono.variable, "font-sans", geist.variable)}>
      <head>
        <link rel="preconnect" href={env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />
        <noscript>
          <style>{`
            .no-js-fallback {
              position: fixed; top: 0; left: 0; right: 0; bottom: 0;
              background: #0e0e10; color: #fff; z-index: 9999;
              display: flex; align-items: center; justify-content: center;
              font-family: sans-serif;
            }
          `}</style>
          <div className="no-js-fallback">
            Presense requires JavaScript to run. Please enable it in your browser settings.
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
                var rawTheme = localStorage.getItem('presense_theme') || 'sunset';
                var theme = rawTheme === 'orange' || rawTheme === 'wahala' || rawTheme === 'blue' || rawTheme === 'navy' ? 'sunset' : rawTheme === 'forest' ? 'meadow' : rawTheme;
                var mode = localStorage.getItem('presense_color_mode') || 'dark';
                var reduceMotion = localStorage.getItem('presense_reduce_motion') === 'true';
                html.classList.remove('theme-blue', 'theme-forest', 'theme-navy', 'theme-midnight', 'theme-meadow', 'light', 'reduce-motion');
                if (theme === 'midnight') html.classList.add('theme-midnight');
                else if (theme === 'meadow') html.classList.add('theme-meadow');
                var isLight = mode === 'light' || (mode === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (isLight) html.classList.add('light');
                if (reduceMotion) html.classList.add('reduce-motion');
                
                var metaTheme = document.createElement('meta');
                metaTheme.name = 'theme-color';
                metaTheme.content = isLight ? '#ffffff' : '#0e0e10';
                document.head.appendChild(metaTheme);
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--color-background)] text-[var(--color-text-2)] transition-colors duration-500">
        <TooltipProvider>
          <WebVitalsReporter />
          <ConnectionStatus />
          <UpdatePrompt />
          {children}
        </TooltipProvider>
        <ToastProvider />
      </body>
    </html>
  );
}
