import { beforeEach, describe, expect, it, vi } from "vitest";
// Imported statically (mocks below are hoisted above it) so the module graph
// loads during collection, not inside the first test's timeout: under a full
// parallel run that cold load alone has exceeded 15s.
import { startGoogleSignIn } from "./actions";

const mockSignInWithOAuth = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signInWithOAuth: mockSignInWithOAuth },
  })),
}));

function createGoogleForm(origin: string) {
  const formData = new FormData();
  formData.set("origin", origin);
  return formData;
}

describe("startGoogleSignIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns to the address the user signed in from", async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: "https://accounts.google.com/o/oauth2/v2/auth?x=1" },
      error: null,
    });

    const result = await startGoogleSignIn(
      createGoogleForm("https://getpresense.vercel.app"),
    );

    expect(result).toEqual({
      url: "https://accounts.google.com/o/oauth2/v2/auth?x=1",
      error: null,
    });
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://getpresense.vercel.app/auth/callback" },
    });
  });

  it("passes Supabase's error through", async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: { message: "Provider is not enabled" },
    });

    const result = await startGoogleSignIn(
      createGoogleForm("https://getpresense.vercel.app"),
    );

    expect(result).toEqual({ error: "Provider is not enabled" });
  });

  it("reports a missing redirect URL instead of navigating nowhere", async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: { url: null }, error: null });

    const result = await startGoogleSignIn(
      createGoogleForm("https://getpresense.vercel.app"),
    );

    expect(result).toEqual({ error: "Failed to start Google sign-in." });
  });
});
