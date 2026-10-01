import { beforeEach, describe, expect, it, vi } from "vitest";
// Imported statically (mocks below are hoisted above it) so the module graph
// loads during collection, not inside the first test's timeout: under a full
// parallel run that cold load alone has exceeded 15s.
import { sendMagicLink, verifyEmailCode } from "./actions";

const mockSignInWithOtp = vi.fn();
const mockVerifyOtp = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockHeaders = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signInWithOtp: mockSignInWithOtp, verifyOtp: mockVerifyOtp },
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

function createCodeForm(email: string, code: string) {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("code", code);
  return formData;
}

// The code in the sign-in email lets someone finish on the device they asked
// from, even if the link opens elsewhere (another device, or a mail app's
// built-in browser) where the PKCE verifier cookie doesn't exist.
describe("verifyEmailCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(true);
    mockVerifyOtp.mockResolvedValue({ error: null });
  });

  it("signs in with the emailed code", async () => {
    const result = await verifyEmailCode(
      createCodeForm(" User@Example.com ", " 123 456 "),
    );

    expect(result).toEqual({ error: null });
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      token: "123456",
      type: "email",
    });
  });

  it("limits attempts per email, whatever the IP, so the code can't be guessed", async () => {
    await verifyEmailCode(createCodeForm("user@example.com", "123456"));

    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      "email-code",
      "user@example.com",
      5,
      600_000,
    );
  });

  it("stops before Supabase once the limit is reached", async () => {
    mockCheckRateLimit.mockResolvedValue(false);

    const result = await verifyEmailCode(
      createCodeForm("user@example.com", "123456"),
    );

    expect(result.error).toBe(
      "Too many attempts. Request a new code in a few minutes.",
    );
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });

  it.each(["", "12345", "12ab56", "12345678901"])(
    "rejects %j without contacting Supabase",
    async (code) => {
      const result = await verifyEmailCode(
        createCodeForm("user@example.com", code),
      );

      expect(result.error).toBe("Enter the code from the email.");
      expect(mockVerifyOtp).not.toHaveBeenCalled();
    },
  );

  it("gives one message for a wrong or expired code", async () => {
    mockVerifyOtp.mockResolvedValue({
      error: { message: "Token has expired or is invalid" },
    });

    const result = await verifyEmailCode(
      createCodeForm("user@example.com", "123456"),
    );

    expect(result.error).toBe(
      "That code is wrong or has expired. Check the latest email, or request a new one.",
    );
  });
});
