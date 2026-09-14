import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

/**
 * Deliberate exception to "never hardcode a hex value in a .tsx file"
 * (AGENTS.md §3): this file renders via next/og's satori-based
 * ImageResponse at the edge, outside any CSS cascade — there is no
 * `--accent` custom property to resolve here. The hex is the dark-mode
 * ("sunset") accent from globals.css, used because a favicon is one
 * fixed asset regardless of the viewer's OS/browser theme.
 */
const ACCENT = "#d97757";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <clipPath id="icon-horizon">
          <rect x="0" y="0" width="24" height="17" />
        </clipPath>
        <circle
          cx="12"
          cy="17"
          r="7"
          fill={ACCENT}
          clipPath="url(#icon-horizon)"
        />
        <line
          x1="3"
          y1="17"
          x2="21"
          y2="17"
          stroke={ACCENT}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>,
    { ...size },
  );
}
