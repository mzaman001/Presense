import React from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDialogFocus } from "../useDialogFocus";

function Dialog() {
  const ref = useDialogFocus(true);
  return (
    <div ref={ref}>
      <input aria-label="Title" data-autofocus="true" />
      <input aria-label="Other" />
    </div>
  );
}

describe("useDialogFocus", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("focuses the autofocus target once the open animation has run", () => {
    render(<Dialog />);
    act(() => vi.advanceTimersByTime(350));
    expect(screen.getByLabelText("Title")).toHaveFocus();
  });

  it("leaves focus alone if it has already moved inside the dialog", () => {
    render(<Dialog />);
    const other = screen.getByLabelText("Other");
    other.focus();
    act(() => vi.advanceTimersByTime(350));
    expect(other).toHaveFocus();
  });
});
