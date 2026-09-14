import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { StaleResurfaceBadge } from "@/components/ui/StaleResurfaceBadge";

describe("StaleResurfaceBadge", () => {
  test("renders the given message", () => {
    render(
      <StaleResurfaceBadge message="You haven't revisited this in a while." />,
    );
    expect(
      screen.getByText("You haven't revisited this in a while."),
    ).toBeInTheDocument();
  });

  test("uses accent-family design tokens, not hardcoded colors", () => {
    const { container } = render(<StaleResurfaceBadge message="Stale" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("var(--accent)");
    expect(el.className).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    expect(el.className).not.toMatch(/rgba?\(/);
  });

  test("merges a caller-supplied className", () => {
    const { container } = render(
      <StaleResurfaceBadge message="Stale" className="mt-2" />,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("mt-2");
  });
});
