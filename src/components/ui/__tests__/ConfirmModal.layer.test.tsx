import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

const zLayer = (el: Element) => {
  const m = el.className.toString().match(/\bz-(?:\[(\d+)\]|(\d+))/);
  return m ? Number(m[1] ?? m[2]) : 0;
};

// Confirms open from inside Sheets (the task panel's "Discard changes?" and
// "Move task to trash?"). At the default dialog layer (z-50) they rendered
// under the Sheet (z-[100]): only the backdrop showed, so ✕ looked broken.
describe("ConfirmModal layering", () => {
  it("renders above the Sheet layer by default", () => {
    render(
      <ConfirmModal
        isOpen
        title="Discard changes?"
        description="What you typed hasn't been saved."
        confirmLabel="Discard"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Discard changes?" });
    expect(zLayer(dialog)).toBeGreaterThan(100);
  });
});
