import { beforeEach, describe, expect, it, vi } from "vitest";
// Imported statically (mocks below are hoisted above it) so the module graph
// loads during collection, not inside the first test's timeout: under a full
// parallel run that cold load alone has exceeded 15s.
import { sendMagicLink } from "./actions";

const mockSignInWithOtp = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockHeaders = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signInWithOtp: mockSignInWithOtp },
  })),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

vi.mock("next/headers", () => ({ headers: () => mockHeaders() }));

// The real SDK is the heaviest import here (~750ms cold) and isn't under test.
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

function createMagicLinkForm(email: string) {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("origin", "https://presense.app");
  return formData;
}

describe("sendMagicLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
    mockHeaders.mockResolvedValue(
      new Headers({ "x-forwarded-for": "203.0.113.10, 10.0.0.1" }),
    );
  });

  it("returns the same generic success response when Supabase rejects delivery", async () => {
    mockSignInWithOtp.mockResolvedValue({
      error: { message: "User not found" },
    });

    const result = await sendMagicLink(
      createMagicLinkForm("Known@Example.com"),
    );

    expect(result).toEqual({
      error: null,
      message:
        "If an account exists for this email, a sign-in link has been sent.",
    });
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      "magic-link",
      "known@example.com|203.0.113.10",
      3,
      60_000,
    );
  });

  it("rejects a fourth request before contacting Supabase", async () => {
    mockCheckRateLimit.mockResolvedValue(false);

    const result = await sendMagicLink(createMagicLinkForm("user@example.com"));

    expect(result.error).toBe(
      "Too many sign-in attempts. Please wait a minute and try again.",
    );
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
  });
});
