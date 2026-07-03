import { describe, expect, it } from "vitest";
import { getAuthCallbackUrl } from "@/lib/auth-redirect";

describe("auth redirect URLs", () => {
  it("uses the active browser origin for local auth redirects", () => {
    expect(getAuthCallbackUrl("http://localhost:3000/login")).toBe("http://localhost:3000/auth/callback");
    expect(getAuthCallbackUrl("http://127.0.0.1:5173/login")).toBe("http://127.0.0.1:5173/auth/callback");
  });

  it("falls back to localhost when the current URL is invalid", () => {
    expect(getAuthCallbackUrl("not a url")).toBe("http://localhost:3000/auth/callback");
  });
});
