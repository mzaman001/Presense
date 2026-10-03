import { describe, it, expect, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useIsTouch } from "@/hooks/useIsTouch";

// A minimal matchMedia for the one query useIsTouch asks about. `coarse` is
// the primary pointer being a finger (phones, tablets); a mouse or trackpad
// is "fine".
function installPointer(coarse: boolean) {
  const listeners = new Set<() => void>();
  let matches = coarse;
  const matchMedia = vi.fn((query: string) => ({
    get matches() {
      return query === "(pointer: coarse)" && matches;
    },
    media: query,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  }));
  window.matchMedia = matchMedia as unknown as typeof window.matchMedia;
  return {
    matchMedia,
    setCoarse(next: boolean) {
      matches = next;
      listeners.forEach((l) => l());
    },
  };
}

describe("useIsTouch", () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
  });

  it("asks for the primary pointer, not just any touch support", () => {
    // (pointer: coarse) is the primary input; (any-pointer: coarse) would
    // also be true on touchscreen laptops being used with a mouse.
    const { matchMedia } = installPointer(true);
    renderHook(() => useIsTouch());
    expect(matchMedia).toHaveBeenCalledWith("(pointer: coarse)");
    expect(matchMedia).not.toHaveBeenCalledWith(
      expect.stringContaining("any-pointer"),
    );
  });

  it("is true when the primary pointer is a finger", () => {
    installPointer(true);
    expect(renderHook(() => useIsTouch()).result.current).toBe(true);
  });

  it("is false with a mouse or trackpad", () => {
    installPointer(false);
    expect(renderHook(() => useIsTouch()).result.current).toBe(false);
  });

  it("follows a change of primary pointer, e.g. a tablet docking a mouse", () => {
    const pointer = installPointer(true);
    const { result } = renderHook(() => useIsTouch());
    expect(result.current).toBe(true);

    act(() => pointer.setCoarse(false));
    expect(result.current).toBe(false);
  });
});
