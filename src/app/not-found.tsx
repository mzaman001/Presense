import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-base)] p-6">
      <div className="glass-panel w-full max-w-md rounded-2xl border border-[var(--border-default)] bg-[var(--surface-1)] p-8 text-center">
        <div className="mb-4 text-6xl font-bold text-[var(--accent)]">404</div>
        <h2 className="mb-2 text-xl font-semibold text-[var(--text-1)]">
          Page not found
        </h2>
        <p className="mb-6 text-sm text-[var(--text-2)]">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="inline-block rounded-xl bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-[var(--text-on-accent)] transition hover:opacity-90"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
