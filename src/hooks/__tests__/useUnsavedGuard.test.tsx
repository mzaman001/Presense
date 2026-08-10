import React from "react";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { useUnsavedGuard } from "../useUnsavedGuard";

function fireBeforeUnload(): Event {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event;
}

describe("useUnsavedGuard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does nothing while clean", () => {
    renderHook(() => useUnsavedGuard(false));
    const event = fireBeforeUnload();
    expect(event.defaultPrevented).toBe(false);
  });

  it("prompts (prevents default) while dirty", () => {
    renderHook(() => useUnsavedGuard(true));
    const event = fireBeforeUnload();
    expect(event.defaultPrevented).toBe(true);
  });

  it("attaches the legacy returnValue flag while dirty", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    renderHook(() => useUnsavedGuard(true));

    const handler = addSpy.mock.calls.find(
      (c) => (c[0] as string) === "beforeunload",
    )?.[1] as ((e: BeforeUnloadEvent) => void) | undefined;
    expect(handler).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = { preventDefault: vi.fn() } as any;
    handler?.(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.returnValue).toBe("");
  });

  it("stops prompting when dirty flips to clean", () => {
    const { rerender } = renderHook(
      ({ dirty }: { dirty: boolean }) => useUnsavedGuard(dirty),
      { initialProps: { dirty: true } },
    );
    expect(fireBeforeUnload().defaultPrevented).toBe(true);

    rerender({ dirty: false });
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it("removes the listener on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useUnsavedGuard(true));
    unmount();
    expect(
      removeSpy.mock.calls.some((c) => (c[0] as string) === "beforeunload"),
    ).toBe(true);
  });
});
