interface BrandMarkProps {
  size?: number;
  className?: string;
}

/**
 * The Presense mark: an ensō — the single brush-stroke circle of Zen
 * practice, a sign of presence and attention — with a point of light at
 * its centre: the present moment, and the sun inside the sky (the app's
 * sunrise/sunset idea). The stroke thickens and thins like a brush and
 * leaves the ensō's open gap at the top right.
 *
 * One colour (currentColor; set it with a parent's text colour, like every
 * Lucide icon here), so it reads the same in sunrise and sunset.
 *
 * The geometry is shared with app/icon.tsx and public/icon.svg — change it
 * in all three places (ENSO_PATH below is the source of truth).
 */
export const ENSO_PATH =
  "M20.40 6.95 A9.8 9.8 0 1 1 15.99 3.05 A0.81 0.81 0 0 1 15.77 4.66 A7.3 7.3 0 1 0 19.06 7.57 A0.74 0.74 0 0 1 20.40 6.95 Z";

export function BrandMark({ size = 24, className }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d={ENSO_PATH} />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
