import { beforeEach, describe, expect, it, vi } from "vitest";
// Imported statically (mocks below are hoisted above it) so the module graph
// loads during collection, not inside the first test's timeout: under a full
// parallel run that cold load alone has exceeded 15s.
import { DELETE } from "@/app/api/account/route";

const mockServerGetUser = vi.fn();
const mockAdminDeleteUser = vi.fn();
const mockServiceCreateClient = vi.fn((_args?: unknown[]) => ({
  auth: {
    admin: {
      deleteUser: mockAdminDeleteUser,
    },
  },
  from: mockServiceFrom,
}));

// mockServiceFrom is declared below; `from:` is read lazily.

vi.mock("@/lib/supabase-server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockServerGetUser,
    },
  })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockServiceCreateClient(args),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => true),
}));

// The real SDK is the heaviest import here (~750ms cold) and isn't under test.
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

// Owned rows are removed by ON DELETE CASCADE; the route must not sweep.
const mockServiceFrom = vi.fn();

vi.mock("@/lib/env", () => ({
  env: {
    get NEXT_PUBLIC_SUPABASE_URL() {
      return "https://example.supabase.co";
    },
    get SUPABASE_SERVICE_ROLE_KEY() {
      return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    },
  },
}));

describe("account DELETE route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("deletes the auth user and nothing else: owned rows go with it via ON DELETE CASCADE", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

    mockServerGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "user@example.com" } },
    });
    mockAdminDeleteUser.mockResolvedValue({ data: null, error: null });

    const response = await DELETE(
      new Request("http://localhost/api/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmToken: "user@example.com" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mockAdminDeleteUser).toHaveBeenCalledWith("user-123");
    // The old per-table sweep always found nothing after the cascade.
    expect(mockServiceFrom).not.toHaveBeenCalled();
  });

  it("reports a failure when the auth user cannot be deleted", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";

    mockServerGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "user@example.com" } },
    });
    mockAdminDeleteUser.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    const response = await DELETE(
      new Request("http://localhost/api/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmToken: "user@example.com" }),
      }),
    );

    expect(response.status).toBe(500);
  });
  it("fails closed before creating a service-role client when the service key is missing", async () => {
    mockServerGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "user@example.com" } },
    });

    const response = await DELETE(
      new Request("http://localhost/api/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmToken: "user@example.com" }),
      }),
    );

    expect(response.status).toBe(500);
    expect(mockServiceCreateClient).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      error: "Account deletion is not configured. Please contact support.",
    });
  });
});
