import { describe, it, expect, vi, beforeEach } from "vitest";
import { middleware } from "@/middleware";

// Set required environment variables for the middleware
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-anon-key";

// Define mock actions and response structures
const mockRedirect = vi.fn((url) => ({
  status: 307,
  headers: { Location: typeof url === "string" ? url : url.toString() },
  url: typeof url === "string" ? url : url.toString(),
  cookies: {
    getAll: vi.fn(() => []),
    set: vi.fn(),
  },
}));

const mockNext = vi.fn(() => ({
  status: 200,
  cookies: {
    getAll: vi.fn(() => []),
    set: vi.fn(),
  },
}));

// Mock Next.js next/server module
vi.mock("next/server", () => {
  return {
    NextResponse: {
      next: (...args: any[]) => mockNext(...args),
      redirect: (...args: any[]) => mockRedirect(...args),
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
      
      mockNext.mockReturnValueOnce({
        status: 200,
        cookies: {
          getAll: vi.fn(() => mockCookies),
          set: vi.fn(),
        },
      });

      const req = createMockRequest("/");
      const res = await middleware(req);

      expect(mockRedirect).toHaveBeenCalled();
      expect(res.status).toBe(307);
      expect(res.cookies.set).toHaveBeenCalledTimes(2);
      expect(res.cookies.set).toHaveBeenNthCalledWith(1, "sb-access-token", "token123", { path: "/" });
      expect(res.cookies.set).toHaveBeenNthCalledWith(2, "sb-refresh-token", "refresh123", { path: "/" });
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
