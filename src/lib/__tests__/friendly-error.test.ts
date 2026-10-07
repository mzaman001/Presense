import { describe, it, expect, afterEach, vi } from "vitest";
import { friendlyError } from "@/lib/friendly-error";

// Toasts showed database text ("duplicate key value violates unique
// constraint …", "new row violates row-level security policy …") or, because
// Supabase errors aren't Error objects, "Unknown error".
describe("friendlyError", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("never passes database wording through", () => {
    const msg = friendlyError({
      code: "42501",
      message: 'new row violates row-level security policy for table "items"',
    });
    expect(msg).not.toMatch(/row-level|policy|items/);
  });

  it("explains the common cases plainly", () => {
    expect(friendlyError({ code: "23505", message: "duplicate key" })).toBe(
      "That's already there.",
    );
    expect(friendlyError(new TypeError("Failed to fetch"))).toBe(
      "Couldn't reach Presense. Check your connection and try again.",
    );
  });

  it("says when the device is offline", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(friendlyError({ message: "anything" })).toBe(
      "You're offline. Try again when you're back online.",
    );
  });

  it("falls back to a plain sentence", () => {
    expect(friendlyError(null)).toBe("Something went wrong. Please try again.");
    expect(friendlyError({ code: "XX000", message: "internal" })).toBe(
      "Something went wrong. Please try again.",
    );
  });
});
