/* Every icon the app points browsers at must exist in public/. The icons are
   generated files (scripts/generate-icons.mjs), so a rename or a skipped
   regeneration would otherwise only show up as a broken favicon or a blank
   home screen icon on someone's phone. layout.tsx is read as text because
   importing it pulls in fonts and global CSS. */
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");
const PUBLIC = path.join(ROOT, "public");

const exists = (url: string) =>
  fs.existsSync(path.join(PUBLIC, url.replace(/^\//, "")));

describe("app icons", () => {
  it("every manifest icon (and shortcut icon) is a real file", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(PUBLIC, "manifest.json"), "utf8"),
    ) as {
      icons: { src: string }[];
      shortcuts?: { icons?: { src: string }[] }[];
    };
    const srcs = [
      ...manifest.icons.map((i) => i.src),
      ...(manifest.shortcuts ?? []).flatMap((s) =>
        (s.icons ?? []).map((i) => i.src),
      ),
    ];
    expect(srcs.length).toBeGreaterThan(0);
    for (const src of srcs) expect(exists(src), src).toBe(true);
  });

  it("the favicons and Apple touch icon linked from layout.tsx exist", () => {
    const layout = fs.readFileSync(
      path.join(ROOT, "src/app/layout.tsx"),
      "utf8",
    );
    const icons = layout.slice(layout.indexOf("icons:"));
    const urls = [...icons.matchAll(/"(\/[^"]+\.(?:svg|png))"/g)].map(
      (m) => m[1],
    );
    expect(urls).toEqual(
      expect.arrayContaining([
        "/favicon.svg",
        "/favicon-32.png",
        "/apple-touch-icon.png",
      ]),
    );
    for (const url of urls) expect(exists(url), url).toBe(true);
  });

  it("keeps a maskable icon so Android launchers don't crop the mark", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(PUBLIC, "manifest.json"), "utf8"),
    ) as { icons: { purpose?: string }[] };
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
  });
});
