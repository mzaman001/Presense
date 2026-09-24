/**
 * The tick inside a completed task checkbox. `pathLength` normalises the
 * stroke to 1 so `.check-tick` (globals.css) can draw it on at any size.
 */
export function CheckTick({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        className="check-tick"
        d="M3.5 8.5l3 3 6-7"
        pathLength={1}
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
