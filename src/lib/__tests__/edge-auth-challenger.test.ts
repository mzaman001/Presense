import { describe, it, expect, vi, beforeEach } from "vitest";
import { middleware } from "@/middleware";

// Set required environment variables for the middleware
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-anon-key";

// Define mock actions and response structures
const mockRedirect = vi.fn((url) => {
  const urlStr = typeof url === "string" ? url : url.toString();
  const parsedUrl = new URL(urlStr);
  const cookieStore = new Map<string, any>();
  return {
    status: 307,
    headers: { Location: urlStr },
    url: urlStr,
    nextUrl: parsedUrl,
    cookies: {
      getAll: vi.fn(() => Array.from(cookieStore.values())),
      set: vi.fn((name, value, options) => {
        cookieStore.set(name, { name, value, ...options });
      }),
    },
  };
});

const mockNext = vi.fn((reqInfo) => {
  const cookieStore = new Map<string, any>();
  return {
    status: 200,
    cookies: {
      getAll: vi.fn(() => Array.from(cookieStore.values())),
      set: vi.fn((name, value, options) => {
        cookieStore.set(name, { name, value, ...options });
      }),
    },
  };
});

// Mock Next.js next/server module
vi.mock("next/server", () => {
  return {
    NextResponse: {
      next: (reqInfo: any) => mockNext(reqInfo),
      redirect: (url: any) => mockRedirect(url),
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

let cookiesSetInClientCallback: any[] = [];
const mockCreateServerClient = vi.fn((url, key, config) => {
  // Store the config so we can simulate cookie operations
  mockCreateServerClientConfig = config;
  return mockSupabaseClient;
});

let mockCreateServerClientConfig: any = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: (url: any, key: any, config: any) => mockCreateServerClient(url, key, config),
}));

// Helper function to build a mock NextRequest
function createMockRequest(pathname: string, searchParamsStr = "", initialCookies: any[] = [], initialHeaders = new Map()) {
  const cookieMap = new Map<string, any>();
  initialCookies.forEach(c => cookieMap.set(c.name, c));

  const urlStr = `http://localhost${pathname}${searchParamsStr}`;
  const parsedUrl = new URL(urlStr);

  const nextUrl = {
    pathname,
    search: searchParamsStr,
    searchParams: parsedUrl.searchParams,
    clone() {
      return {
        pathname: this.pathname,
        search: this.search,
        searchParams: new URLSearchParams(this.search),
        toString() {
          const qs = this.search ? (this.search.startsWith("?") ? this.search : `?${this.search}`) : "";
          return `http://localhost${this.pathname}${qs}`;
        }
      };
    },
    toString() {
      return urlStr;
    },
  };

  return {
    nextUrl,
    url: urlStr,
    headers: {
      get: vi.fn((key) => initialHeaders.get(key.toLowerCase()) || null),
    },
    cookies: {
      getAll: vi.fn(() => Array.from(cookieMap.values())),
      set: vi.fn((name, value, options) => {
        cookieMap.set(name, { name, value, ...options });
      }),
    },
  } as unknown as any;
}

describe("Edge Auth Middleware Challenger Verification Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateServerClientConfig = null;
    cookiesSetInClientCallback = [];
  });

  describe("Scenario 1: Malformed or Missing Auth Headers & Cookies", () => {
    it("handles missing auth cookies entirely (redirects unauthenticated to /login)", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/do");
      const res = await middleware(req);

      expect(mockRedirect).toHaveBeenCalled();
      expect(res.status).toBe(307);
      expect(res.url).toContain("/login");
    });

    it("handles missing auth cookies but valid-looking Authorization header (still redirects if cookies are the only source of truth)", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const headers = new Map();
      headers.set("authorization", "Bearer mock-jwt-token");
      const req = createMockRequest("/do", "", [], headers);
      const res = await middleware(req);

      expect(mockRedirect).toHaveBeenCalled();
      expect(res.status).toBe(307);
      expect(res.url).toContain("/login");
    });

    it("handles malformed cookies (e.g., junk string) that cause getUser to return null", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("Invalid token format") });
      const cookies = [{ name: "sb-access-token", value: "malformed-junk-token" }];
      const req = createMockRequest("/do", "", cookies);
      const res = await middleware(req);

      expect(mockRedirect).toHaveBeenCalled();
      expect(res.status).toBe(307);
      expect(res.url).toContain("/login");
    });

    it("verifies middleware behavior when supabase.auth.getUser throws an exception", async () => {
      // In the implementation, there is no try-catch around getUser(), so it throws to the caller/Next.js runtime.
      mockGetUser.mockRejectedValue(new Error("Database connection timeout"));
      const req = createMockRequest("/do");

      await expect(middleware(req)).rejects.toThrow("Database connection timeout");
    });
  });

  describe("Scenario 2: Redirect Routing Behavior (Trailing slashes, Capital Letters, and Params)", () => {
    // 2. Verify redirects with trailing slashes, capital letters, or parameters (e.g., `/do?param=1`).
    
    it("unauthenticated request to protected path with trailing slash (/do/) redirects to /login", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/do/");
      const res = await middleware(req);

      expect(mockRedirect).toHaveBeenCalled();
      expect(res.status).toBe(307);
      expect(res.url).toBe("http://localhost/login");
    });

    it("authenticated request to protected path with trailing slash (/do/) is allowed (no redirect)", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
      const req = createMockRequest("/do/");
      const res = await middleware(req);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it("unauthenticated request to capital letters protected path (/DO) redirects to /login", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/DO");
      const res = await middleware(req);

      expect(mockRedirect).toHaveBeenCalled();
      expect(res.status).toBe(307);
      expect(res.url).toBe("http://localhost/login");
    });

    it("authenticated request to capital letters protected path (/DO) is allowed (no redirect)", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
      const req = createMockRequest("/DO");
      const res = await middleware(req);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it("unauthenticated request to capital letters auth path (/LOGIN) redirects to /login because startsWith('/login') is case-sensitive", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/LOGIN");
      const res = await middleware(req);

      // Since /LOGIN does not start with lowercase '/login', isAuthRoute is false.
      // Unauthenticated user -> redirects to /login.
      expect(mockRedirect).toHaveBeenCalled();
      expect(res.status).toBe(307);
      expect(res.url).toBe("http://localhost/login");
    });

    it("authenticated request to capital letters auth path (/LOGIN) does NOT redirect to / (remains on /LOGIN) due to case sensitivity in startsWith('/login')", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
      const req = createMockRequest("/LOGIN");
      const res = await middleware(req);

      // For authenticated user:
      // Since /LOGIN is case-sensitive, isAuthRoute is false.
      // The condition (user && isAuthRoute) is false.
      // So no redirect to / occurs.
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it("unauthenticated request to protected path with parameters (/do?param=1) redirects to /login preserving the parameters", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/do", "?param=1");
      const res = await middleware(req);

      expect(mockRedirect).toHaveBeenCalled();
      expect(res.status).toBe(307);
      // It should keep query params
      expect(res.url).toBe("http://localhost/login?param=1");
    });

    it("authenticated request to login with parameters (/login?param=1) redirects to / preserving the parameters", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
      const req = createMockRequest("/login", "?param=1");
      const res = await middleware(req);

      expect(mockRedirect).toHaveBeenCalled();
      expect(res.status).toBe(307);
      // It should keep query params
      expect(res.url).toBe("http://localhost/?param=1");
    });
  });

  describe("Scenario 3: Cookie Forwarding and Loop Prevention", () => {
    // 3. Ensure that cookies are successfully forwarded in all redirection responses and that no loops occur.

    it("ensures cookies set by Supabase client during auth check are forwarded in redirect responses", async () => {
      mockGetUser.mockImplementation(async () => {
        // Simulate Supabase client calling setAll to set cookies
        if (mockCreateServerClientConfig?.cookies?.setAll) {
          mockCreateServerClientConfig.cookies.setAll([
            { name: "sb-access-token", value: "new-access-token", options: { path: "/", maxAge: 3600 } },
            { name: "sb-refresh-token", value: "new-refresh-token", options: { path: "/", maxAge: 3600 } }
          ]);
        }
        return { data: { user: { id: "user-123" } } };
      });

      // Authenticated user requests /login -> should redirect to / and forward the new cookies
      const req = createMockRequest("/login");
      const res = await middleware(req);

      expect(mockRedirect).toHaveBeenCalled();
      expect(res.status).toBe(307);
      expect(res.url).toBe("http://localhost/");

      // Verify that the redirected response has cookies set
      expect(res.cookies.set).toHaveBeenCalledTimes(2);
      expect(res.cookies.set).toHaveBeenNthCalledWith(1, "sb-access-token", "new-access-token", { path: "/", maxAge: 3600 });
      expect(res.cookies.set).toHaveBeenNthCalledWith(2, "sb-refresh-token", "new-refresh-token", { path: "/", maxAge: 3600 });
    });

    it("prevents redirect loops for unauthenticated users accessing /login", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/login");
      const res = await middleware(req);

      // Should not redirect (should call Next.next())
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it("prevents redirect loops for authenticated users accessing /", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
      const req = createMockRequest("/");
      const res = await middleware(req);

      // Should not redirect (should call Next.next())
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it("prevents redirect loops for unauthenticated users accessing /auth/callback", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = createMockRequest("/auth/callback");
      const res = await middleware(req);

      // Should not redirect (should call Next.next())
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });
  });
});
