import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[var(--bg-base)] px-4 py-10 sm:py-16">
      <article className="legal-prose mx-auto max-w-[640px]">
        <Link
          href="/"
          className="text-ui text-[var(--accent-text)] underline underline-offset-2"
        >
          ← Presense
        </Link>
        {children}
        <p className="text-meta mt-10 text-[var(--text-3)]">
          Last updated {LEGAL.lastUpdated}
        </p>
      </article>
    </div>
  );
}
