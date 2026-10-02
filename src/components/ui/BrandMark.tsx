import { ENSO_BRUSH_SMALL } from "./enso-brush-small";

interface BrandMarkProps {
  size?: number;
  className?: string;
}

/**
 * The Presense mark: an ensō, the single brush-stroke circle of Zen
 * practice, a sign of presence and attention, with the sun at its centre:
 * the present moment (and the app's sunrise/sunset idea). The stroke lands
 * heavy, thins as it travels and leaves the ensō's open gap at the top
 * right.
 *
 * Two tones, like the sign-in screen: the ink is currentColor (set it with
 * a parent's text colour, normally --text-1, so it is cream at sunset and
 * dark ink at sunrise) and the sun is always --accent.
 *
 * This is the one-stroke brush (ENSO_BRUSH_SMALL), which stays crisp down
 * to a 16px favicon. The app icons (public/icon*.svg/png) use the full ink
 * brush with dry bristles, which only reads from ~96px; regenerate them
 * with scripts/generate-icons.mjs, which also draws the favicons
 * (public/favicon.svg, favicon-32.png) from this shape and dot.
 */
export const BRAND_DOT = { cx: 51.7, cy: 50.1, r: 13 } as const;

export function BrandMark({ size = 24, className }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d={ENSO_BRUSH_SMALL} />
      <circle {...BRAND_DOT} style={{ fill: "var(--accent)" }} />
    </svg>
  );
}
