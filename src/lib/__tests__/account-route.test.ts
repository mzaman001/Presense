import { beforeEach, describe, expect, it, vi } from "vitest";

const mockServerGetUser = vi.fn();
const mockAdminDeleteUser = vi.fn();
const mockServiceCreateClient = vi.fn((_args?: unknown[]) => ({
  auth: {
    admin: {
      deleteUser: mockAdminDeleteUser,
    },
  },
}));

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

  it("fails closed before creating a service-role client when the service key is missing", async () => {
    const { DELETE } = await import("@/app/api/account/route");
    mockServerGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "user@example.com" } },
    });

    const response = await DELETE(
      new Request("http://localhost/api/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmToken: "user@example.com" }),
      })
    );

    expect(response.status).toBe(500);
    expect(mockServiceCreateClient).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      error: "Account deletion is not configured. Please contact support.",
    });
  });
});
