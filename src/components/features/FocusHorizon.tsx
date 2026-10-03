import type { CSSProperties } from "react";

/**
 * The focus screen's background: ink hills on the horizon and the app's
 * orange sun above them. The sun is the session made visible: it sinks
 * behind the hills as a work session runs and rises again over a break,
 * so how much is left reads at a glance without the clock.
 *
 * One static SVG and one moving disc. The disc moves by transform only,
 * once a second when the timer ticks (`.focus-sun` eases between ticks),
 * so nothing repaints per frame. Colours are the theme's own (--sky-*,
 * --accent, --text-1 mixed into --bg-base), so light mode gets a dawn.
 * Styles: `.focus-horizon` in globals.css.
 */
export function FocusHorizon({
  sun,
}: {
  /** Height of the sun: 1 is high in the sky, 0 has set behind the hills. */
  sun: number;
}) {
  const height = Math.min(1, Math.max(0, sun));
  return (
    <div
      aria-hidden="true"
      className="focus-horizon"
      style={{ "--sun": height.toFixed(4) } as CSSProperties}
    >
      <div className="focus-sun" />
      <svg
        className="focus-hills"
        viewBox="0 0 1600 400"
        preserveAspectRatio="none"
      >
        <path
          className="focus-hill-back"
          d="M0 40C200 0 380 10 560 50S900 0 1100 40S1440 10 1600 50V400H0Z"
        />
        <path
          className="focus-hill-mid"
          d="M0 150C240 80 420 130 640 110S1000 50 1200 120S1480 100 1600 130V400H0Z"
        />
        <path
          className="focus-hill-front"
          d="M0 270C260 210 480 260 720 230S1120 190 1340 250S1540 240 1600 260V400H0Z"
        />
      </svg>
    </div>
  );
}
