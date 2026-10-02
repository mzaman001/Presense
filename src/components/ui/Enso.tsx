// clsx, not cn(): cn() brings tailwind-merge (~8 KiB gz) onto /login, and
// these classes never conflict.
import { clsx } from "clsx";
import { ENSO_BRUSH } from "./enso-brush-ink";
import { ENSO_BRUSH_SMALL } from "./enso-brush-small";
import { BRAND_DOT } from "./BrandMark";

interface EnsoProps {
  /** Rendered width and height in px. */
  size: number;
  /**
   * `ink` is the large brush with dry bristle streaks; `small` is one
   * tapered stroke for checkboxes and spinners. Defaults by size.
   */
  variant?: "ink" | "small";
  /** Paint the stroke on once when it mounts (`.enso-draw` in globals.css). */
  draw?: boolean;
  /** Keep the brush going round while something loads. */
  spin?: boolean;
  /** The point at the centre: the present moment. */
  dot?: boolean;
  className?: string;
  /** Colour the dot separately, e.g. the accent "sun" on the ink stroke. */
  dotClassName?: string;
}

// The stroke is lopsided (heavy through the bottom), so the dot sits between
// the centre of the inner hole and the centre of the outline, which is where
// the eye reads the middle. Measured from the paths in enso-brush-*.ts.
const DOT = {
  ink: { cx: 51.7, cy: 50.4, r: 9.5 },
  small: BRAND_DOT,
} as const;

/**
 * The brush ensō: Presense's motion identity, drawn for the moments that
 * deserve one: signing in, finishing a task, an empty day. The logo
 * (BrandMark) is the same brush, still.
 *
 * Drawing is pure CSS: a conic mask sweeps round from the start of the stroke
 * (`--enso-p` in globals.css), so there are no SVG ids and no JS. Colour
 * comes from currentColor.
 */
export function Enso({
  size,
  variant = size < 48 ? "small" : "ink",
  draw = false,
  spin = false,
  dot = true,
  className,
  dotClassName,
}: EnsoProps) {
  const d = DOT[variant];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="currentColor"
      aria-hidden="true"
      className={clsx(
        "enso",
        draw && "enso-draw",
        spin && "enso-spin",
        className,
      )}
    >
      <path d={variant === "ink" ? ENSO_BRUSH : ENSO_BRUSH_SMALL} />
      {dot && !spin && (
        <circle
          className={clsx("enso-dot", dotClassName)}
          fill="currentColor"
          cx={d.cx}
          cy={d.cy}
          r={d.r}
        />
      )}
    </svg>
  );
}
