import { describe, it, expect, vi, beforeEach } from "vitest";
import { middleware } from "@/middleware";

// Set required environment variables for the middleware
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-anon-key";

// Mock env module to prevent throwing at import time
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  },
}));

// Define mock actions and response structures
const mockRedirect = vi.fn((url) => ({
  status: 307,
  headers: {
    set: vi.fn(),
    get: vi.fn(() => typeof url === "string" ? url : url.toString()),
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
    set: vi.fn(),
  },
  cookies: {
    getAll: vi.fn(() => []),
    set: vi.fn(),
  },
}));

// Mock Next.js next/server module
vi.mock("next/server", () => {
  return {
    NextResponse: {
      next: (...args: any[]) => (mockNext as any)(...args),
      redirect: (...args: any[]) => (mockRedirect as any)(...args),
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

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => mockSupabaseClient),
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
  });

  describe("Unauthenticated requests", () => {
    it("redirects unauthenticated requests to / to /login with 307 redirect", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/");
      const res = await middleware(req);

      expect(mockRedirect).toHaveBeenCalled();
      expect(res.status).toBe(307);
      expect(res.url).toContain("/login");
    });

    it("redirects unauthenticated requests to protected paths (e.g., /do) to /login with 307 redirect", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/do");
      const res = await middleware(req);

      expect(mockRedirect).toHaveBeenCalled();
      expect(res.status).toBe(307);
      expect(res.url).toContain("/login");
    });

    it("copies cookies from supabaseResponse to the redirect response", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      
      const mockCookies = [
        { name: "sb-access-token", value: "token123", path: "/" },
        { name: "sb-refresh-token", value: "refresh123", path: "/" }
      ];
      
      const mockSet = vi.fn();
      mockNext.mockReturnValue({
        status: 200,
        headers: {
          set: vi.fn(),
        },
        cookies: {
          getAll: vi.fn((): { name: string; value: string; path: string }[] => mockCookies),
          set: mockSet,
        },
      } as any);

      const req = createMockRequest("/");
      const res = await middleware(req);

      expect(mockRedirect).toHaveBeenCalled();
      expect(res.status).toBe(307);
      expect(mockSet).toHaveBeenCalled();
    });
  });

  describe("Authenticated requests", () => {
    it("redirects authenticated requests to /login to / with 307 redirect", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
      const req = createMockRequest("/login");
      const res = await middleware(req);

      expect(mockRedirect).toHaveBeenCalled();
      expect(res.status).toBe(307);
      expect(res.url).toBe("http://localhost/");
    });

    it("allows authenticated requests to protected paths (e.g., /do) without redirecting", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
      const req = createMockRequest("/do");
      const res = await middleware(req);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).toBe(200);
      expect(res).not.toHaveProperty("status", 307);
    });
  });

  describe("Exception handling", () => {
    it("redirects to /login when supabase.auth.getUser() throws an error on a protected path", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockGetUser.mockRejectedValue(new Error("Supabase connection failed"));
      const req = createMockRequest("/do");
      const res = await middleware(req);

      expect(mockRedirect).toHaveBeenCalled();
      expect(res.status).toBe(307);
      expect(res.url).toContain("/login");
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("returns original response when supabase.auth.getUser() throws an error on the /login path", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockGetUser.mockRejectedValue(new Error("Supabase connection failed"));
      const req = createMockRequest("/login");
      const res = await middleware(req);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).toBe(200);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
