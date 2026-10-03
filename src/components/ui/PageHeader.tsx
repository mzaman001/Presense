import { ReactNode } from "react";

/**
 * The one page header: a two-column grid, so everything shares two edges.
 *
 *   title (serif) ............................ [actions]
 *   description
 *   [toolbar: view switch] ................... [toolbarEnd: search, filters]
 *
 * The left column holds the title and the view switch, so they start on
 * the same line. The right column is as wide as its widest item: the
 * actions sit at its right edge and `toolbarEnd` fills it, so a search box
 * under "Daily note · New thread" spans exactly the same width rather
 * than stopping short.
 *
 * Actions stay on the title row at every width, so a primary button never
 * drops onto a line of its own on a phone; below md the toolbar items take
 * the full width, one per row. Toolbar controls share the 36px height.
 */
export function PageHeader({
  title,
  subtitle,
  description,
  actions,
  toolbar,
  toolbarEnd,
}: {
  title: ReactNode;
  subtitle?: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Left of the second row, under the title: usually a SegmentedControl. */
  toolbar?: ReactNode;
  /** Right of the second row, under the actions: search or filters. */
  toolbarEnd?: ReactNode;
}) {
  return (
    <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 md:grid-cols-[minmax(max-content,1fr)_auto] md:gap-x-6">
      {subtitle && (
        <p className="text-label col-span-2 mb-1.5 text-[var(--accent-text)]">
          {subtitle}
        </p>
      )}
      <h1 className="text-page-title flex min-h-10 min-w-0 items-center text-[var(--text-1)]">
        <span className="truncate">{title}</span>
      </h1>
      {actions && (
        <div className="flex shrink-0 items-center gap-2 justify-self-end">
          {actions}
        </div>
      )}
      {description && (
        <p className="text-body col-span-2 mt-1.5 max-w-prose text-[var(--text-3)]">
          {description}
        </p>
      )}
      {toolbar && (
        <div className="col-span-2 col-start-1 mt-4 flex min-w-0 md:col-span-1">
          {toolbar}
        </div>
      )}
      {toolbarEnd && (
        <div
          className={
            toolbar
              ? "col-span-2 col-start-1 mt-3 flex min-w-0 md:col-span-1 md:col-start-2 md:mt-4 md:justify-end"
              : "col-span-2 col-start-1 mt-4 flex min-w-0 md:col-span-1 md:col-start-2 md:justify-end"
          }
        >
          {toolbarEnd}
        </div>
      )}
    </header>
  );
}
