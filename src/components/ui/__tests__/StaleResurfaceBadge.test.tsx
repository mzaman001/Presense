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

  test("renders nothing when message is null", () => {
    const { container } = render(<StaleResurfaceBadge message={null} />);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing when message is undefined", () => {
    const { container } = render(<StaleResurfaceBadge message={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing when message is an empty string", () => {
    const { container } = render(<StaleResurfaceBadge message="" />);
    expect(container.firstChild).toBeNull();
  });

  describe("badge variant (default)", () => {
    test("uses accent-family design tokens, not hardcoded colors", () => {
      const { container } = render(<StaleResurfaceBadge message="Stale" />);
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain("var(--accent");
      expect(el.className).not.toMatch(/#[0-9a-fA-F]{3,6}/);
      expect(el.className).not.toMatch(/rgba?\(/);
    });

    test("renders a bordered pill with an icon", () => {
      const { container } = render(<StaleResurfaceBadge message="Stale" />);
      const el = container.firstChild as HTMLElement;
      expect(el.tagName).toBe("DIV");
      expect(el.className).toContain("border");
      expect(el.querySelector("svg")).not.toBeNull();
    });

    test("merges a caller-supplied className", () => {
      const { container } = render(
        <StaleResurfaceBadge message="Stale" className="mt-2" />,
      );
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain("mt-2");
    });
  });

  describe("text variant", () => {
    test("renders bare text with no border or icon", () => {
      const { container } = render(
        <StaleResurfaceBadge message="Stale" variant="text" />,
      );
      const el = container.firstChild as HTMLElement;
      expect(el.tagName).toBe("P");
      expect(el.className).not.toContain("border");
      expect(el.querySelector("svg")).toBeNull();
    });

    test("uses accent-family design tokens, not hardcoded colors", () => {
      const { container } = render(
        <StaleResurfaceBadge message="Stale" variant="text" />,
      );
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain("var(--accent)");
      expect(el.className).not.toMatch(/#[0-9a-fA-F]{3,6}/);
      expect(el.className).not.toMatch(/rgba?\(/);
    });

    test("merges a caller-supplied className", () => {
      const { container } = render(
        <StaleResurfaceBadge message="Stale" variant="text" className="mt-2" />,
      );
      const el = container.firstChild as HTMLElement;
      expect(el.className).toContain("mt-2");
    });
  });
});
