import { beforeEach, describe, expect, it, vi } from "vitest";

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

// AUDIT-06 (Aug 19, 2026): mockServiceFrom is declared after this const but
// the `from:` property is read lazily, so the reference resolves fine.

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

// AUDIT-06 (Aug 19, 2026): after deleteUser, every owned row must be purged.
const mockFromDelete = vi.fn();
const mockServiceFrom = vi.fn(() => ({
  delete: () => mockFromDelete(),
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

  it("purges every owned table after deleteUser and only reports success when all succeed", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    const { DELETE } = await import("@/app/api/account/route");

    mockServerGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "user@example.com" } },
    });
    mockAdminDeleteUser.mockResolvedValue({ data: null, error: null });
    // Ten owned tables, all succeeding.
    mockFromDelete.mockImplementation(() => {
      const chain = { eq: () => Promise.resolve({ data: null, error: null }) };
      return chain;
    });

    const response = await DELETE(
      new Request("http://localhost/api/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmToken: "user@example.com" }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      purgedTables: expect.arrayContaining([
        "items",
        "threads",
        "people",
        "explores",
        "locations",
        "push_subscriptions",
        "user_settings",
        "categories",
        "session_logs",
        "ritual_logs",
      ]),
    });
    // deleteUser must run before the purge; purge runs exactly 10 sweeps.
    expect(mockAdminDeleteUser).toHaveBeenCalledOnce();
    expect(mockAdminDeleteUser).toHaveBeenCalledWith("user-123");
    expect(mockFromDelete).toHaveBeenCalledTimes(10);
  });

  it("reports PURGE_PARTIAL (207) when any owned-table delete fails", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    const { DELETE } = await import("@/app/api/account/route");

    mockServerGetUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "user@example.com" } },
    });
    mockAdminDeleteUser.mockResolvedValue({ data: null, error: null });
    let call = 0;
    mockFromDelete.mockImplementation(() => ({
      eq: () =>
        Promise.resolve(
          call++ === 2
            ? { data: null, error: { message: "table gone" } }
            : { data: null, error: null },
        ),
    }));

    const response = await DELETE(
      new Request("http://localhost/api/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmToken: "user@example.com" }),
      }),
    );

    expect(response.status).toBe(207);
    const body = await response.json();
    expect(body.code).toBe("PURGE_PARTIAL");
    expect(body.failedTables.length).toBe(1);
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
      }),
    );

    expect(response.status).toBe(500);
    expect(mockServiceCreateClient).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      error: "Account deletion is not configured. Please contact support.",
    });
  });
});
