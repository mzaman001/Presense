import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  test.each(["primary", "secondary", "ghost", "danger"] as const)(
    "%s provides keyboard focus and touch styles",
    (variant) => {
      render(<Button variant={variant}>Action</Button>);
      expect(screen.getByRole("button", { name: "Action" })).toHaveClass(
        "focus-visible:outline-solid",
        "focus-visible:outline-2",
        "focus-visible:outline-offset-2",
        "focus-visible:outline-[var(--border-focus)]",
        "touch-manipulation",
      );
    },
  );

  test("renders its label", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  test("defaults to the primary variant with a flat accent background, no gradient", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.className).toContain("bg-[var(--accent)]");
    expect(button.className).not.toContain("gradient");
  });

  test("secondary variant is an outline, not filled", () => {
    render(<Button variant="secondary">Cancel</Button>);
    const button = screen.getByRole("button", { name: "Cancel" });
    expect(button.className).toContain("border-[var(--border-default)]");
    expect(button.className).toContain("bg-transparent");
  });

  test("ghost variant has no border and no background", () => {
    render(<Button variant="ghost">Dismiss</Button>);
    const button = screen.getByRole("button", { name: "Dismiss" });
    expect(button.className).toContain("bg-transparent");
    expect(button.className).not.toContain("border-[var(--border-default)]");
  });

  test("danger variant uses the status-danger token, not a hardcoded red", () => {
    render(<Button variant="danger">Delete</Button>);
    const button = screen.getByRole("button", { name: "Delete" });
    expect(button.className).toContain("var(--status-danger)");
  });
});
