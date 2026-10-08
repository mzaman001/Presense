import React, { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

// Like Settings: a visible last button, then controls that are rendered but
// hidden (a phone-only strip, a panel not shown).
function DialogWithHidden() {
  const ref = useDialogFocus(true);
  return (
    <div ref={ref}>
      <button>First</button>
      <button>Last visible</button>
      <div hidden>
        <button>Hidden strip</button>
      </div>
      <button style={{ display: "none" }}>Not shown</button>
    </div>
  );
}

// Like Settings and the sheets since #79: closing unmounts the dialog
// instead of setting isOpen to false.
function UnmountingHost() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <button>Elsewhere</button>
      {open && <UnmountingDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function UnmountingDialog({ onClose }: { onClose: () => void }) {
  const ref = useDialogFocus(true);
  return (
    <div ref={ref}>
      <button onClick={onClose}>Close</button>
    </div>
  );
}

function Nested() {
  const outer = useDialogFocus(true);
  return (
    <>
      <div ref={outer}>
        <button>Outer</button>
      </div>
      <Inner />
    </>
  );
}

function Inner() {
  const ref = useDialogFocus(true);
  return (
    <div ref={ref}>
      <button>Inner first</button>
      <button>Inner last</button>
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

  it("wraps Tab from the last visible control, skipping hidden ones", () => {
    render(<DialogWithHidden />);
    screen.getByText("Last visible").focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByText("First")).toHaveFocus();
  });

  it("wraps Shift+Tab from the first control to the last visible one", () => {
    render(<DialogWithHidden />);
    screen.getByText("First").focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(screen.getByText("Last visible")).toHaveFocus();
  });

  it("pulls focus back in when Tab is pressed from outside the dialog", () => {
    render(
      <>
        <button>Behind</button>
        <DialogWithHidden />
      </>,
    );
    screen.getByText("Behind").focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByText("First")).toHaveFocus();
  });

  it("returns focus to the trigger when the dialog unmounts", () => {
    render(<UnmountingHost />);
    const trigger = screen.getByText("Open");
    trigger.focus();
    fireEvent.click(trigger);
    act(() => vi.advanceTimersByTime(350));
    expect(screen.getByText("Close")).toHaveFocus();

    fireEvent.click(screen.getByText("Close"));
    act(() => vi.advanceTimersByTime(350));
    expect(trigger).toHaveFocus();
  });

  it("only the topmost dialog traps Tab", () => {
    render(<Nested />);
    screen.getByText("Inner last").focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByText("Inner first")).toHaveFocus();
  });
});
