import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
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
    apple: "/icon-180.png",
  },
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#E5B41E",
};

import { ToastProvider } from "@/components/ui/ToastProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`} style={{ transition: 'background-color 300ms ease, color 300ms ease' }}>
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var html = document.documentElement;
                var theme = localStorage.getItem('presense_theme') || 'wahala';
                var mode = localStorage.getItem('presense_color_mode') || 'dark';
                var reduceMotion = localStorage.getItem('presense_reduce_motion') === 'true';
                html.classList.remove('theme-blue', 'theme-forest', 'theme-navy', 'light', 'reduce-motion');
                // Handle legacy 'blue' and 'orange' values
                if (theme === 'navy' || theme === 'blue') html.classList.add('theme-navy');
                else if (theme === 'forest') html.classList.add('theme-forest');
                // wahala / orange = default, no extra class
                if (mode === 'light') html.classList.add('light');
                else if (mode === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches) html.classList.add('light');
                if (reduceMotion) html.classList.add('reduce-motion');
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--color-background)] text-[var(--color-text-2)] transition-colors duration-500">
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
