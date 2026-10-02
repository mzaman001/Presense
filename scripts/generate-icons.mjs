// Builds the app icons from the brush ensō (src/components/ui/enso-brush-*.ts).
//
//   node scripts/generate-icons.mjs
//
// Writes public/icon.svg (the "any" icon, also the README logo) and
// public/favicon.svg (the browser tab icon, one-stroke brush), and renders
// the PNGs the manifest lists: icon-96/192/512 (rounded tile) and
// icon-192/512-maskable (full-bleed, mark inside the 80% safe zone so a
// launcher's circle or squircle crop never cuts the brush), plus
// apple-touch-icon.png (iOS home screen) and favicon-32.png (PNG favicon
// fallback). layout.tsx links the favicons and the Apple icon.
//
// The icons use the full ink brush with dry bristles (it reads from ~96px);
// the in-app mark and the favicon use the one-stroke brush (BrandMark).
// Run it again after scripts/generate-enso.mjs.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const read = (name) =>
  readFileSync(
    new URL(`../src/components/ui/${name}`, import.meta.url),
    "utf8",
  );
const INK = read("enso-brush-ink.ts").match(/ENSO_BRUSH =\s*"([^"]+)"/)[1];
const SMALL = read("enso-brush-small.ts").match(
  /ENSO_BRUSH_SMALL =\s*"([^"]+)"/,
)[1];

// Sunset palette from globals.css: one fixed asset, so fixed hex values.
const TILE = "#141118"; // --bg-base (dark)
const STROKE = "#f4ede4"; // --text-1 (dark)
const SUN = "#e3875f"; // --accent (dark)
const DOT = { cx: 51.7, cy: 50.4, r: 9.5 }; // Enso.tsx, ink variant
const SMALL_DOT = { cx: 51.7, cy: 50.1, r: 13 }; // BrandMark

/**
 * @param {{ rounded: boolean, mark: number, d?: string, dot?: typeof DOT }} o
 *   mark = share of the tile the 100-unit brush box takes
 */
function iconSvg({ rounded, mark, d = INK, dot = DOT }) {
  const S = 512;
  const rx = rounded ? 112 : 0;
  const scale = (S * mark) / 100;
  const offset = (S - S * mark) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <radialGradient id="dusk" cx="50%" cy="112%" r="80%">
      <stop offset="0" stop-color="#e37852" stop-opacity=".34"/>
      <stop offset="1" stop-color="#e37852" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sky" cx="85%" cy="-15%" r="70%">
      <stop offset="0" stop-color="#805caa" stop-opacity=".22"/>
      <stop offset="1" stop-color="#805caa" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${S}" height="${S}" rx="${rx}" fill="${TILE}"/>
  <rect width="${S}" height="${S}" rx="${rx}" fill="url(#sky)"/>
  <rect width="${S}" height="${S}" rx="${rx}" fill="url(#dusk)"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="${d}" fill="${STROKE}"/>
    <circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}" fill="${SUN}"/>
  </g>
</svg>
`;
}

// The brush spans ~85% of its 100-unit box, so a 0.62 mark fills about half
// the tile (like the old icon) and 0.5 keeps the maskable one well inside
// the safe zone (radius 40% of the tile).
const any = iconSvg({ rounded: true, mark: 0.62 });
const maskable = iconSvg({ rounded: false, mark: 0.5 });
// The browser-tab favicon (layout.tsx metadata): one-stroke brush, drawn
// larger, because the bristles blur into a smudge at 16px.
const favicon = iconSvg({
  rounded: true,
  mark: 0.74,
  d: SMALL,
  dot: SMALL_DOT,
});
// iOS ignores manifest icons and rounds the corners itself, so its home
// screen icon is a full-bleed square with the same ink brush.
const apple = iconSvg({ rounded: false, mark: 0.62 });

writeFileSync(new URL("../public/icon.svg", import.meta.url), any);
writeFileSync(new URL("../public/favicon.svg", import.meta.url), favicon);

const out = (name) =>
  fileURLToPath(new URL(`../public/${name}`, import.meta.url));
const render = (svg, size, name) =>
  sharp(Buffer.from(svg), { density: 72 * (size / 512) * 4 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out(name));

await Promise.all([
  render(any, 96, "icon-96.png"),
  render(any, 192, "icon-192.png"),
  render(any, 512, "icon-512.png"),
  render(maskable, 192, "icon-192-maskable.png"),
  render(maskable, 512, "icon-512-maskable.png"),
  render(apple, 180, "apple-touch-icon.png"),
  // PNG fallback for browsers that don't use SVG favicons (older Safari).
  render(favicon, 32, "favicon-32.png"),
]);
console.log("icons written");
