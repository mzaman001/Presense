import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Enso } from "@/components/ui/Enso";
import { ENSO_BRUSH, ENSO_BRUSH_SMALL } from "@/components/ui/enso-paths";

describe("Enso", () => {
  it("is decorative: hidden from assistive tech", () => {
    const { container } = render(<Enso size={96} />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("uses the bristled ink brush when large and the plain stroke when small", () => {
    const big = render(<Enso size={96} />).container;
    const small = render(<Enso size={20} />).container;
    expect(big.querySelector("path")?.getAttribute("d")).toBe(ENSO_BRUSH);
    expect(small.querySelector("path")?.getAttribute("d")).toBe(
      ENSO_BRUSH_SMALL,
    );
  });

  it("only animates when asked to draw or spin", () => {
    const still = render(<Enso size={28} />).container.querySelector("svg");
    const drawn = render(<Enso size={28} draw />).container.querySelector(
      "svg",
    );
    expect(still?.getAttribute("class")).toBe("enso");
    expect(drawn?.getAttribute("class")).toContain("enso-draw");
  });

  it("drops the dot while spinning, so a spinner is just the moving brush", () => {
    const spinner = render(<Enso size={16} spin />).container;
    expect(spinner.querySelector("svg")?.getAttribute("class")).toContain(
      "enso-spin",
    );
    expect(spinner.querySelector(".enso-dot")).toBeNull();
  });

  it("colours the dot separately when given a dot class", () => {
    const { container } = render(
      <Enso size={96} dotClassName="text-[var(--accent)]" />,
    );
    const dot = container.querySelector(".enso-dot");
    expect(dot?.getAttribute("class")).toContain("text-[var(--accent)]");
    expect(dot?.getAttribute("fill")).toBe("currentColor");
  });
});
