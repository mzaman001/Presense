import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { BrandMark } from "@/components/ui/BrandMark";

describe("BrandMark", () => {
  test("renders an svg with the default 24px size", () => {
    const { container } = render(<BrandMark />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveAttribute("height", "24");
  });

  test("accepts a custom size", () => {
    const { container } = render(<BrandMark size={32} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "32");
    expect(svg).toHaveAttribute("height", "32");
  });

  test("uses currentColor, not a hardcoded fill or a gradient", () => {
    const { container } = render(<BrandMark />);
    const html = container.innerHTML;
    expect(html).toContain("currentColor");
    expect(html).not.toContain("linearGradient");
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  test("is decorative — hidden from screen readers", () => {
    const { container } = render(<BrandMark />);
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
