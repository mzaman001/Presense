import { ReactNode } from "react";

/**
 * The one page header, in two rows:
 *
 *   1. Title (serif) on the left, the page's actions on the right. Actions
 *      stay on this row at every width, so a primary button never drops
 *      onto a line of its own on a phone.
 *   2. An optional toolbar (`children`): view switches, search. Controls in
 *      it share the 36px toolbar height so the row reads as one line; on
 *      phones each control takes the full width.
 */
export function PageHeader({
  title,
  subtitle,
  description,
  actions,
  children,
}: {
  title: ReactNode;
  subtitle?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex shrink-0 flex-col gap-4">
      <div>
        {subtitle && (
          <p className="text-label mb-1.5 text-[var(--accent-text)]">
            {subtitle}
          </p>
        )}
        <div className="flex min-h-10 items-center justify-between gap-3">
          <h1 className="text-page-title min-w-0 truncate text-[var(--text-1)]">
            {title}
          </h1>
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </div>
        {description && (
          <p className="text-body mt-1.5 max-w-prose text-[var(--text-3)]">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
          {children}
        </div>
      )}
    </header>
  );
}
