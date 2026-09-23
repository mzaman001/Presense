import { describe, expect, it, vi } from "vitest";
import { withPreload } from "@/lib/preloadable";

describe("withPreload", () => {
  it("returns the same component with a callable preload that runs the loader", () => {
    const Component = () => null;
    const load = vi.fn().mockResolvedValue({});
    const Wrapped = withPreload(Component, load);

    expect(Wrapped).toBe(Component);
    Wrapped.preload();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("swallows a failed prefetch instead of producing an unhandled rejection", async () => {
    const load = vi.fn().mockRejectedValue(new Error("offline"));
    const Wrapped = withPreload(() => null, load);

    expect(() => Wrapped.preload()).not.toThrow();
    // Let the rejected promise settle; an unhandled rejection would fail the run.
    await Promise.resolve();
    await Promise.resolve();
  });
});
