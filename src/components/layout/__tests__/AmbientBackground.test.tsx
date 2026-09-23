import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AmbientBackground } from "@/components/layout/AmbientBackground";

describe("AmbientBackground", () => {
  test("renders a single decorative atmosphere layer", () => {
    const { container } = render(<AmbientBackground />);
    const layer = container.firstElementChild;
    expect(container.childElementCount).toBe(1);
    expect(layer).toHaveClass("atmosphere");
    // Purely decorative: hidden from assistive tech, no content, no children.
    expect(layer).toHaveAttribute("aria-hidden", "true");
    expect(layer).toBeEmptyDOMElement();
  });
});
