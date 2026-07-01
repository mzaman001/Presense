import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";

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
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("h-full", "antialiased", inter.variable, jetbrainsMono.variable, "font-sans", geist.variable)}>
      <head>
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />
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
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var html = document.documentElement;
                var theme = localStorage.getItem('presense_theme') || 'orange';
                var mode = localStorage.getItem('presense_color_mode') || 'dark';
                var reduceMotion = localStorage.getItem('presense_reduce_motion') === 'true';
                html.classList.remove('theme-blue', 'theme-forest', 'theme-navy', 'light', 'reduce-motion');
                if (theme === 'blue') html.classList.add('theme-navy');
                else if (theme === 'forest') html.classList.add('theme-forest');
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
          <ConnectionStatus />
          {children}
        </TooltipProvider>
        <ToastProvider />
      </body>
    </html>
  );
}
