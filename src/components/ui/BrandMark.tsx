interface BrandMarkProps {
  size?: number;
  className?: string;
}

/**
 * The app's mark: a horizon line with a rising/setting sun's dome above
 * it, in one color (currentColor — set color via a parent's
 * `text-[var(--accent)]` className, the same convention every Lucide
 * icon in this app already uses). No gradient, no second color, so it
 * reads identically in both light ("sunrise") and dark ("sunset") mode.
 */
export function BrandMark({ size = 24, className }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <clipPath id="brand-mark-horizon">
          <rect x="0" y="0" width="24" height="17" />
        </clipPath>
      </defs>
      <circle
        cx="12"
        cy="17"
        r="7"
        fill="currentColor"
        clipPath="url(#brand-mark-horizon)"
      />
      <line
        x1="3"
        y1="17"
        x2="21"
        y2="17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
