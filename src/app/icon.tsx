import { ImageResponse } from "next/og";
import { ENSO_PATH } from "@/components/ui/BrandMark";

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
const ACCENT = "#e3875f";

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
      <svg width="28" height="28" viewBox="0 0 24 24" fill={ACCENT}>
        <path d={ENSO_PATH} />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </div>,
    { ...size },
  );
}
