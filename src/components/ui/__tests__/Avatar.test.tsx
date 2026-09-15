import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Avatar } from "@/components/ui/Avatar";

/**
 * Contrast is checked against real backgrounds, not asserted by trusting a
 * formula: every color here is one this app actually renders an avatar
 * with (the default, every Settings > Avatar Color preset, and every
 * DEFAULT_DO_COLORS default) per src/lib/constants.ts and
 * SettingsModal.tsx's avatar-color picker.
 */
function relativeLuminance(hex: string): number {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const lin = (v: number) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const BACKGROUNDS_IN_USE = [
  "#E5B41E", // Avatar.tsx's own default
  "#F472B6", // Settings > Avatar Color presets
  "#4ADE80",
  "#3B82F6",
  "#FBBF24",
  "#A855F7",
  "#EF4444",
  "#F59E0B", // DEFAULT_DO_COLORS defaults
  "#8B5CF6",
  "#6B7280",
  "#10B981",
  "#9CA3AF",
  "#d97757", // avatarAccentFallback() dark-mode accent (Navigation.tsx/MobileTopBar.tsx)
  "#9c4a2e", // avatarAccentFallback() light-mode accent (Navigation.tsx/MobileTopBar.tsx)
];

describe("Avatar", () => {
  test.each(BACKGROUNDS_IN_USE)(
    "initials text clears 4.5:1 against background %s regardless of app color mode",
    (bg) => {
      render(<Avatar name="Jordan Lee" color={bg} />);
      const initials = screen.getByText("JL");
      const computedColor =
        initials.style.color || getComputedStyle(initials).color;
      // jsdom returns rgb(...) from getComputedStyle; parse it back to hex.
      const rgbMatch = computedColor.match(/\d+/g);
      expect(rgbMatch).not.toBeNull();
      const [r, g, b] = rgbMatch!.map(Number);
      const toHex = (n: number) => n.toString(16).padStart(2, "0");
      const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();

      expect(contrastRatio(hex, bg)).toBeGreaterThanOrEqual(4.5);
    },
  );

  test("renders a black-or-white initials color, never a mode-driven token", () => {
    render(<Avatar name="Ada Lovelace" color="#E5B41E" />);
    const container = screen.getByRole("img", {
      name: "Ada Lovelace's avatar",
    });
    expect(container.style.color).toMatch(/^rgb\((0, 0, 0|255, 255, 255)\)$/);
  });

  test("still renders initials and the accessible role/label", () => {
    render(<Avatar name="Grace Hopper" color="#3B82F6" />);
    expect(
      screen.getByRole("img", { name: "Grace Hopper's avatar" }),
    ).toBeInTheDocument();
    expect(screen.getByText("GH")).toBeInTheDocument();
  });
});
