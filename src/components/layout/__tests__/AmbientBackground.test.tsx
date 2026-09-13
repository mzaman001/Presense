import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AmbientBackground } from "@/components/layout/AmbientBackground";

describe("AmbientBackground", () => {
  test("renders nothing — the ambient orb/glass system is retired", () => {
    const { container } = render(<AmbientBackground />);
    expect(container).toBeEmptyDOMElement();
  });
});
