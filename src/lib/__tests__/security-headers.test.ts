import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

// next.config.ts can't be imported under vitest (Sentry and Serwist wrappers),
// so the header contract is checked in its source.
const source = fs.readFileSync(
  path.resolve(__dirname, "../../../next.config.ts"),
  "utf8",
);

describe("Permissions-Policy", () => {
  it("lets the app itself use the microphone (voice capture)", () => {
    // `microphone=()` denied it to the site's own pages: speech recognition
    // failed with "not-allowed" even after the user granted permission.
    expect(source).toContain("microphone=(self)");
    expect(source).not.toContain("microphone=()");
  });

  it("still denies camera and location", () => {
    expect(source).toContain("camera=()");
    expect(source).toContain("geolocation=()");
  });
});
