import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const loader = require("../sentry-no-tracing-loader.cjs") as (
  source: string,
) => string;

describe("sentry-no-tracing-loader", () => {
  it("turns Sentry's tracing guard into a constant false", () => {
    const source =
      'if (typeof __SENTRY_TRACING__ === "undefined" || __SENTRY_TRACING__) { return "traced"; } return "skipped";';
    const out = loader(source);
    expect(out).not.toContain("__SENTRY_TRACING__");
    // typeof false is "boolean", so the guard is false and the bundler can
    // drop the tracing branch, as webpack's DefinePlugin lets it.
    expect(new Function(out)()).toBe("skipped");
  });

  it("leaves identifiers that only contain the name alone", () => {
    const source =
      "const x__SENTRY_TRACING__y = 1; const $__SENTRY_TRACING__ = 2;";
    expect(loader(source)).toBe(source);
  });
});
