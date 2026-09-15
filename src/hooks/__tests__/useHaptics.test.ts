import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useHaptics } from "@/hooks/useHaptics";

describe("useHaptics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (navigator as unknown as Record<string, unknown>).vibrate;
  });

  it("calls navigator.vibrate with the expected pattern when supported", () => {
    const vibrate = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "vibrate", {
      value: vibrate,
      configurable: true,
    });

    const { result } = renderHook(() => useHaptics());
    result.current.heavy();

    expect(vibrate).toHaveBeenCalledWith([30, 20, 30, 20, 30]);
  });

  it("does not throw and makes no call when the Vibration API is absent (iOS Safari)", () => {
    // iOS Safari does not implement the Vibration API at all — `"vibrate"
    // in navigator` is false there. Simulate that by ensuring the
    // property is entirely absent, not just falsy.
    delete (navigator as unknown as Record<string, unknown>).vibrate;
    expect("vibrate" in navigator).toBe(false);

    const { result } = renderHook(() => useHaptics());

    expect(() => result.current.success()).not.toThrow();
    expect(() => result.current.medium()).not.toThrow();
  });

  it("swallows an exception thrown by navigator.vibrate instead of propagating it", () => {
    const vibrate = vi.fn(() => {
      throw new Error("blocked by permissions policy");
    });
    Object.defineProperty(navigator, "vibrate", {
      value: vibrate,
      configurable: true,
    });

    const { result } = renderHook(() => useHaptics());

    expect(() => result.current.light()).not.toThrow();
    expect(vibrate).toHaveBeenCalled();
  });
});
