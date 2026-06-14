import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
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
};

import { ToastProvider } from "@/components/ui/ToastProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                let theme = localStorage.getItem('presense_theme') || 'orange';
                let mode = localStorage.getItem('presense_color_mode') || 'dark';
                
                if (theme === 'blue') document.documentElement.classList.add('theme-blue');
                if (theme === 'forest') document.documentElement.classList.add('theme-forest');
                if (mode === 'light') document.documentElement.classList.add('light');
              } catch (e) {}
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
