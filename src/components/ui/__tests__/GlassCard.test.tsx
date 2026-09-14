import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GlassCard } from "@/components/ui/GlassCard";

describe("GlassCard", () => {
  it("never applies backdrop-filter, gradients, or glow shadows in any variant", () => {
    (["list", "elevated", "hero"] as const).forEach((variant) => {
      const { container } = render(<GlassCard variant={variant} />);
      const className = container.firstChild
        ? (container.firstChild as HTMLElement).className
        : "";
      expect(className).not.toMatch(/backdrop-filter/);
      expect(className).not.toMatch(/linear-gradient/);
      expect(className).not.toMatch(/shadow-accent-glow/);
    });
  });
});
