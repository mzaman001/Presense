/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { proxy, cspReportUri, cspSentryIngestOrigin } from "@/proxy";

// Set required environment variables for the middleware
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-anon-key";

// Mock env module to prevent throwing at import time.
// Getters read process.env lazily so tests can flip values between requests.
vi.mock("@/lib/env", () => ({
  env: {
    get NEXT_PUBLIC_SUPABASE_URL() {
      return (
        process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co"
      );
    },
    get NEXT_PUBLIC_SUPABASE_ANON_KEY() {
      return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "mock-anon-key";
    },
    get SUPABASE_SERVICE_ROLE_KEY() {
      return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    },
    get UPSTASH_REDIS_REST_URL() {
      return process.env.UPSTASH_REDIS_REST_URL || "";
    },
    get UPSTASH_REDIS_REST_TOKEN() {
      return process.env.UPSTASH_REDIS_REST_TOKEN || "";
    },
    get NEXT_PUBLIC_SENTRY_DSN() {
      return process.env.NEXT_PUBLIC_SENTRY_DSN || "";
    },
  },
}));

// Recorded response headers for CSP assertions
const headerStore = new Map<string, string>();

// Define mock actions and response structures
const mockRedirect = vi.fn((url) => ({
  status: 307,
  headers: {
    set: vi.fn((key: string, value: string) => {
      headerStore.set(key, value);
    }),
    get: vi.fn((key: string) => headerStore.get(key) ?? ""),
  },
  url: typeof url === "string" ? url : url.toString(),
  cookies: {
    getAll: vi.fn(() => []),
    set: vi.fn(),
  },
}));

const mockNext = vi.fn(() => ({
  status: 200,
  headers: {
    set: vi.fn((key: string, value: string) => {
      headerStore.set(key, value);
    }),
    get: vi.fn((key: string) => headerStore.get(key) ?? ""),
  },
  cookies: {
    getAll: vi.fn(() => []),
    set: vi.fn(),
  },
}));

// Mock Next.js next/server module
const mockJson = vi.fn((_body, init) => ({
  status: init?.status ?? 200,
  body: _body,
  headers: {
    set: vi.fn(),
    get: vi.fn(() => "application/json"),
  },
  cookies: { getAll: vi.fn(() => []), set: vi.fn() },
}));

vi.mock("next/server", () => {
  return {
    NextResponse: {
      next: (...args: any[]) => (mockNext as any)(...args),
      redirect: (...args: any[]) => (mockRedirect as any)(...args),
      json: (...args: any[]) => (mockJson as any)(...args),
    },
  };
});

// Mock Supabase Server Client
const mockGetUser = vi.fn();
const mockSupabaseClient = {
  auth: {
    getUser: mockGetUser,
  },
};

let mockCreateServerClientConfig: any = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url, _key, config) => {
    mockCreateServerClientConfig = config;
    return mockSupabaseClient;
  }),
}));

// Helper function to build a mock NextRequest
function createMockRequest(pathname: string) {
  const nextUrl = {
    pathname,
    clone() {
      return {
        ...this,
        pathname: this.pathname,
      };
    },
    toString() {
      return `http://localhost${this.pathname}`;
    },
  };

  return {
    nextUrl,
    cookies: {
      getAll: vi.fn(() => []),
      set: vi.fn(),
    },
    url: `http://localhost${pathname}`,
  } as unknown as any;
}

describe("Edge Auth Middleware Routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateServerClientConfig = null;
    headerStore.clear();
  });

  describe("Unauthenticated requests", () => {
    it("redirects unauthenticated requests to / to /login with 307 redirect", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/");
      const res = await proxy(req);

      expect(mockRedirect).toHaveBeenCalled();
      expect(res.status).toBe(307);
      expect(res.url).toContain("/login");
    });

    it("redirects unauthenticated requests to protected paths (e.g., /do) to /login with 307 redirect", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/do");
      const res = await proxy(req);

      expect(mockRedirect).toHaveBeenCalled();
      expect(res.status).toBe(307);
      expect(res.url).toContain("/login");
    });

    /* AUDIT-02 (Aug 19, 2026): /api/* routes must return JSON 401 instead of
       the HTML 307 redirect, so programmatic consumers (bots, mobile) get a
       usable response. Page routes keep the 307 behavior unchanged. */

    it("returns JSON 401 for unauthenticated requests to /api/* routes", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/api/capture");
      const res = await proxy(req);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({ code: "AUTH_REQUIRED" }),
        { status: 401 },
      );
      expect(res.status).toBe(401);
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("carries a stable error payload on the /api/* 401", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/api/people/reorder");
      const res = await proxy(req);

      expect(res.body).toMatchObject({
        error: "Unauthorized",
        code: "AUTH_REQUIRED",
      });
    });

    it("keeps the 307 /login redirect for unauthenticated page routes", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/do");
      const res = await proxy(req);

      expect(mockRedirect).toHaveBeenCalled();
      expect(res.status).toBe(307);
    });

    it("copies cookies set by Supabase to the redirect response", async () => {
      mockGetUser.mockImplementation(async () => {
        mockCreateServerClientConfig.cookies.setAll([
          {
            name: "sb-access-token",
            value: "token123",
            options: { path: "/" },
          },
          {
            name: "sb-refresh-token",
            value: "refresh123",
            options: { path: "/" },
          },
        ]);
        return { data: { user: null } };
      });

      const req = createMockRequest("/");
      const res = await proxy(req);

      expect(mockRedirect).toHaveBeenCalled();
      expect(res.status).toBe(307);
      expect(res.cookies.set).toHaveBeenCalledWith(
        "sb-access-token",
        "token123",
        { path: "/" },
      );
      expect(res.cookies.set).toHaveBeenCalledWith(
        "sb-refresh-token",
        "refresh123",
        { path: "/" },
      );
    });
  });

  describe("Authenticated requests", () => {
    it("redirects authenticated requests to /login to / with 307 redirect", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
      const req = createMockRequest("/login");
      const res = await proxy(req);

      expect(mockRedirect).toHaveBeenCalled();
      expect(res.status).toBe(307);
      expect(res.url).toBe("http://localhost/");
    });

    it("allows authenticated requests to protected paths (e.g., /do) without redirecting", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
      const req = createMockRequest("/do");
      const res = await proxy(req);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).toBe(200);
      expect(res).not.toHaveProperty("status", 307);
    });
  });

  describe("CSP report-uri (Sentry)", () => {
    it("derives the security endpoint from an EU DSN", () => {
      expect(
        cspReportUri(
          "https://3b802d3cf21ac6b135bbde1081dc639d@o4511896684789760.ingest.de.sentry.io/4511896692850768",
        ),
      ).toBe(
        "https://o4511896684789760.ingest.de.sentry.io/api/4511896692850768/security/?sentry_key=3b802d3cf21ac6b135bbde1081dc639d",
      );
    });

    it("derives the security endpoint from a US DSN", () => {
      expect(
        cspReportUri("https://abc123@o450000.ingest.sentry.io/450000"),
      ).toBe(
        "https://o450000.ingest.sentry.io/api/450000/security/?sentry_key=abc123",
      );
    });

    it("returns an empty string for missing or malformed DSNs", () => {
      expect(cspReportUri(undefined)).toBe("");
      expect(cspReportUri("")).toBe("");
      expect(cspReportUri("not-a-dsn")).toBe("");
      expect(cspReportUri("http://abc@o123.ingest.sentry.io/456")).toBe("");
    });

    it("omits report-uri from the CSP when no DSN is configured", async () => {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/do");
      await proxy(req);

      expect(headerStore.get("Content-Security-Policy")).not.toContain(
        "report-uri",
      );
    });

    it("derives the ingest origin from an EU DSN", () => {
      expect(
        cspSentryIngestOrigin(
          "https://3b802d3cf21ac6b135bbde1081dc639d@o4511896684789760.ingest.de.sentry.io/4511896692850768",
        ),
      ).toBe("https://o4511896684789760.ingest.de.sentry.io");
    });

    it("derives the ingest origin from a US DSN", () => {
      expect(
        cspSentryIngestOrigin("https://abc123@o450000.ingest.sentry.io/450000"),
      ).toBe("https://o450000.ingest.sentry.io");
    });

    it("returns an empty string for missing or malformed DSNs", () => {
      expect(cspSentryIngestOrigin(undefined)).toBe("");
      expect(cspSentryIngestOrigin("")).toBe("");
      expect(cspSentryIngestOrigin("not-a-dsn")).toBe("");
      expect(
        cspSentryIngestOrigin("http://abc@o123.ingest.sentry.io/456"),
      ).toBe("");
    });

    it("omits the Sentry origin from connect-src when no DSN is configured", async () => {
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/do");
      await proxy(req);

      const csp = headerStore.get("Content-Security-Policy") ?? "";
      const connectSrc = csp.match(/connect-src ([^;]+)/)?.[1] ?? "";
      expect(connectSrc.trim()).toBe(
        "'self' https://*.supabase.co wss://*.supabase.co",
      );
    });

    it("appends the Sentry ingest origin to connect-src when a DSN is configured", async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN =
        "https://3b802d3cf21ac6b135bbde1081dc639d@o4511896684789760.ingest.de.sentry.io/4511896692850768";
      try {
        mockGetUser.mockResolvedValue({ data: { user: null } });
        const req = createMockRequest("/do");
        await proxy(req);

        const csp = headerStore.get("Content-Security-Policy") ?? "";
        expect(csp).toContain(
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://o4511896684789760.ingest.de.sentry.io",
        );
      } finally {
        delete process.env.NEXT_PUBLIC_SENTRY_DSN;
      }
    });

    it("appends report-uri to the CSP derived from the DSN when configured", async () => {
      process.env.NEXT_PUBLIC_SENTRY_DSN =
        "https://3b802d3cf21ac6b135bbde1081dc639d@o4511896684789760.ingest.de.sentry.io/4511896692850768";
      try {
        mockGetUser.mockResolvedValue({ data: { user: null } });
        const req = createMockRequest("/do");
        await proxy(req);

        expect(headerStore.get("Content-Security-Policy")).toContain(
          "report-uri https://o4511896684789760.ingest.de.sentry.io/api/4511896692850768/security/?sentry_key=3b802d3cf21ac6b135bbde1081dc639d",
        );
      } finally {
        delete process.env.NEXT_PUBLIC_SENTRY_DSN;
      }
    });
  });

  describe("Exception handling", () => {
    it("redirects to /login when supabase.auth.getUser() throws an error on a protected path", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockGetUser.mockRejectedValue(new Error("Supabase connection failed"));
      const req = createMockRequest("/do");
      const res = await proxy(req);

      expect(mockRedirect).toHaveBeenCalled();
      expect(res.status).toBe(307);
      expect(res.url).toContain("/login");
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("returns original response when supabase.auth.getUser() throws an error on the /login path", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockGetUser.mockRejectedValue(new Error("Supabase connection failed"));
      const req = createMockRequest("/login");
      const res = await proxy(req);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).toBe(200);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});

describe("CSP strict-dynamic removal (INCIDENT-2026-08-22)", () => {
  it("does not include 'strict-dynamic' in the script-src directive", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const req = createMockRequest("/login");
    await proxy(req);

    const csp = headerStore.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).not.toContain("'strict-dynamic'");
  });
});
