import React from "react";
import { render, screen, fireEvent, waitFor, act } from "./test-utils";
import { TEST_USER } from "./test-utils";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SearchModal } from "@/components/features/SearchModal";
import { SettingsModal } from "@/components/features/SettingsModal";
import ThreadDetailPage from "@/app/(app)/think/[id]/page";
import { useAppStore } from "@/store/useAppStore";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/think",
}));

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// Setup React Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SessionProvider user={TEST_USER}>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </SessionProvider>
);

/**
 * A chainable Supabase query stub: every builder method returns the same
 * object, and awaiting it resolves to { data, error }.
 */
type MockQuery = Record<string, ReturnType<typeof vi.fn>> & {
  then: ReturnType<typeof vi.fn>;
};

describe("Phase 3 - Integration Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();

    // Mock matchMedia for jsdom
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Reset Zustand store state
    useAppStore.setState({
      isCaptureModalOpen: false,
      isSearchModalOpen: false,
      isSettingsModalOpen: false,
      userSettings: {},
    });
  });

  // Helper function to build a chainable Supabase query mock
  function mockSupabaseQuery(
    data: unknown = null,
    error: unknown = null,
  ): MockQuery {
    const query: MockQuery = {
      select: vi.fn().mockImplementation(() => query),
      eq: vi.fn().mockImplementation(() => query),
      in: vi.fn().mockImplementation(() => query),
      order: vi.fn().mockImplementation(() => query),
      limit: vi.fn().mockImplementation(() => query),
      or: vi.fn().mockImplementation(() => query),
      update: vi.fn().mockImplementation(() => query),
      insert: vi.fn().mockImplementation(() => query),
      delete: vi.fn().mockImplementation(() => query),
      single: vi.fn().mockImplementation(() => query),
      then: vi.fn().mockImplementation((onfulfilled) => {
        return Promise.resolve(onfulfilled({ data, error }));
      }),
    };
    query.then = vi
      .fn()
      .mockImplementation((resolve) => resolve({ data, error }));
    return query;
  }

  describe("R1: SearchModal Requirements", () => {
    it.each(["reported query error", "rejected network promise"])(
      "shows an error and stops loading for a %s",
      async (failure) => {
        useAppStore.setState({ isSearchModalOpen: true });
        mockSupabase.from.mockImplementation(() => {
          const query = mockSupabaseQuery(
            null,
            new Error("Search unavailable"),
          );
          if (failure === "rejected network promise") {
            query.limit.mockImplementation(() =>
              Promise.reject(new TypeError("Failed to fetch")),
            );
          }
          return query;
        });

        render(<SearchModal />, { wrapper });
        fireEvent.change(screen.getByPlaceholderText(/search everything/i), {
          target: { value: "study" },
        });

        expect(await screen.findByRole("alert")).toHaveTextContent(
          /could not search/i,
        );
        expect(screen.getByRole("button", { name: /retry/i })).toBeEnabled();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        expect(screen.queryByText("No results")).not.toBeInTheDocument();
      },
    );

    it("retries a failed search and renders the recovered results", async () => {
      useAppStore.setState({ isSearchModalOpen: true });
      mockSupabase.from.mockImplementation(() =>
        mockSupabaseQuery(null, new Error("Search unavailable")),
      );
      render(<SearchModal />, { wrapper });
      fireEvent.change(screen.getByPlaceholderText(/search everything/i), {
        target: { value: "study" },
      });
      const retry = await screen.findByRole("button", { name: /retry/i });
      mockSupabase.from.mockImplementation((table) =>
        mockSupabaseQuery(
          table === "items"
            ? [{ id: "recovered", title: "Recovered task" }]
            : [],
        ),
      );

      fireEvent.click(retry);

      expect(await screen.findByText("Recovered task")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it.each(["", "   "])(
      "ignores an in-flight response after the input becomes %j",
      async (value) => {
        useAppStore.setState({ isSearchModalOpen: true });
        let resolveSearch!: (value: unknown) => void;
        const pending = new Promise((resolve) => {
          resolveSearch = resolve;
        });
        mockSupabase.from.mockImplementation((table) => {
          const query = mockSupabaseQuery([]);
          if (table === "items") query.limit.mockReturnValue(pending);
          return query;
        });
        render(<SearchModal />, { wrapper });
        const input = screen.getByPlaceholderText(/search everything/i);
        fireEvent.change(input, { target: { value: "old" } });
        await waitFor(() => expect(mockSupabase.from).toHaveBeenCalledTimes(3));
        fireEvent.change(input, { target: { value } });
        await act(async () => {
          resolveSearch({
            data: [{ id: "old", title: "Old result" }],
            error: null,
          });
        });

        expect(screen.queryByText("Old result")).not.toBeInTheDocument();
        expect(screen.getByText("Search your brain")).toBeInTheDocument();
        expect(screen.queryByText("No results")).not.toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
        fireEvent.keyDown(input, { key: "Enter" });
        expect(push).not.toHaveBeenCalled();
      },
    );

    it("does not let an older response replace a newer query's results", async () => {
      useAppStore.setState({ isSearchModalOpen: true });
      let resolveOld!: (value: unknown) => void;
      const pending = new Promise((resolve) => {
        resolveOld = resolve;
      });
      mockSupabase.from.mockImplementation((table) => {
        const query = mockSupabaseQuery([]);
        if (table === "items") query.limit.mockReturnValue(pending);
        return query;
      });
      render(<SearchModal />, { wrapper });
      const input = screen.getByPlaceholderText(/search everything/i);
      fireEvent.change(input, { target: { value: "old" } });
      await waitFor(() => expect(mockSupabase.from).toHaveBeenCalledTimes(3));
      mockSupabase.from.mockImplementation((table) =>
        mockSupabaseQuery(
          table === "items" ? [{ id: "new", title: "New result" }] : [],
        ),
      );
      fireEvent.change(input, { target: { value: "new" } });
      expect(await screen.findByText("New result")).toBeInTheDocument();
      await act(async () => {
        resolveOld({ data: [{ id: "old", title: "Old result" }], error: null });
      });
      expect(screen.queryByText("Old result")).not.toBeInTheDocument();
      expect(screen.getByText("New result")).toBeInTheDocument();
    });

    it("hides previous results during debounce and keeps keyboard selection safe", async () => {
      useAppStore.setState({ isSearchModalOpen: true });
      mockSupabase.from.mockImplementation((table) =>
        mockSupabaseQuery(
          table === "threads"
            ? [
                { id: "first", title: "First thread" },
                { id: "second", title: "Second thread" },
              ]
            : [],
        ),
      );
      render(<SearchModal />, { wrapper });
      const input = screen.getByPlaceholderText(/search everything/i);
      fireEvent.change(input, { target: { value: "thread" } });
      fireEvent.keyDown(input, { key: "ArrowDown" });
      await screen.findByText("First thread");
      fireEvent.keyDown(input, { key: "ArrowDown" });
      mockSupabase.from.mockImplementation((table) =>
        mockSupabaseQuery(
          table === "threads" ? [{ id: "new", title: "New thread" }] : [],
        ),
      );
      fireEvent.change(input, { target: { value: "new" } });
      expect(screen.queryByText("First thread")).not.toBeInTheDocument();
      expect(screen.queryByText("Second thread")).not.toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(/searching/i);
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(push).not.toHaveBeenCalled();
      await screen.findByText("New thread");
      fireEvent.keyDown(input, { key: "Enter" });
      expect(push).toHaveBeenCalledWith("/think/new");
    });

    it("does not search blank input or fetch while closed", async () => {
      useAppStore.setState({ isSearchModalOpen: true });
      mockSupabase.from.mockImplementation(() => mockSupabaseQuery([]));
      render(<SearchModal />, { wrapper });
      const input = screen.getByPlaceholderText(/search everything/i);
      fireEvent.change(input, { target: { value: "   " } });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 350));
      });
      expect(mockSupabase.from).not.toHaveBeenCalled();
      fireEvent.change(input, { target: { value: "study" } });
      act(() => useAppStore.setState({ isSearchModalOpen: false }));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 350));
      });
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("does not search without a user id", async () => {
      useAppStore.setState({ isSearchModalOpen: true });
      mockSupabase.from.mockImplementation(() => mockSupabaseQuery([]));
      render(
        <SessionProvider user={{ ...TEST_USER, id: "" }}>
          <SearchModal />
        </SessionProvider>,
        { wrapper },
      );
      fireEvent.change(screen.getByPlaceholderText(/search everything/i), {
        target: { value: "study" },
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 350));
      });
      expect(mockSupabase.from).not.toHaveBeenCalled();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("scopes cached search results to the current user", async () => {
      useAppStore.setState({ isSearchModalOpen: true });
      mockSupabase.from.mockImplementation((table) =>
        mockSupabaseQuery(
          table === "items"
            ? [{ id: "first", title: "First user's task" }]
            : [],
        ),
      );
      const { rerender } = render(
        <SessionProvider user={TEST_USER}>
          <SearchModal />
        </SessionProvider>,
        { wrapper },
      );
      fireEvent.change(screen.getByPlaceholderText(/search everything/i), {
        target: { value: "study" },
      });
      await screen.findByText("First user's task");
      mockSupabase.from.mockImplementation((table) =>
        mockSupabaseQuery(
          table === "items"
            ? [{ id: "second", title: "Second user's task" }]
            : [],
        ),
      );
      rerender(
        <SessionProvider user={{ ...TEST_USER, id: "second-user" }}>
          <SearchModal />
        </SessionProvider>,
      );
      expect(screen.queryByText("First user's task")).not.toBeInTheDocument();
      expect(await screen.findByText("Second user's task")).toBeInTheDocument();
    });

    it("re-queries the same term after unmount and reopen despite a 5-minute staleTime default", async () => {
      const originalDefaults = queryClient.getDefaultOptions();
      queryClient.setDefaultOptions({
        queries: { ...originalDefaults.queries, staleTime: 5 * 60 * 1000 },
      });
      try {
        useAppStore.setState({ isSearchModalOpen: true });
        mockSupabase.from.mockImplementation((table) =>
          mockSupabaseQuery(
            table === "items" ? [{ id: "stale", title: "Stale row" }] : [],
          ),
        );
        const first = render(<SearchModal />, { wrapper });
        fireEvent.change(screen.getByPlaceholderText(/search everything/i), {
          target: { value: "study" },
        });
        await screen.findByText("Stale row");
        const callsAfterFirstSearch = mockSupabase.from.mock.calls.length;
        first.unmount();

        mockSupabase.from.mockImplementation((table) =>
          mockSupabaseQuery(
            table === "items" ? [{ id: "fresh", title: "Fresh row" }] : [],
          ),
        );
        render(<SearchModal />, { wrapper });
        fireEvent.change(screen.getByPlaceholderText(/search everything/i), {
          target: { value: "study" },
        });

        await waitFor(() =>
          expect(mockSupabase.from.mock.calls.length).toBeGreaterThan(
            callsAfterFirstSearch,
          ),
        );
        expect(await screen.findByText("Fresh row")).toBeInTheDocument();
        expect(screen.queryByText("Stale row")).not.toBeInTheDocument();
      } finally {
        queryClient.setDefaultOptions(originalDefaults);
      }
    });

    it("should verify that SearchModal supports searching items by category", async () => {
      useAppStore.setState({ isSearchModalOpen: true });

      // Mock search response for items by category
      mockSupabase.from.mockImplementation((table) => {
        if (table === "items") {
          return mockSupabaseQuery([
            { id: "task-1", title: "Review React docs", category: "study" },
          ]);
        }
        return mockSupabaseQuery([]);
      });

      render(<SearchModal />, { wrapper });

      const searchInput = screen.getByPlaceholderText(/search everything/i);
      expect(searchInput).toBeInTheDocument();

      // Trigger searching by category
      fireEvent.change(searchInput, { target: { value: "study" } });

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith("items");
      });

      const taskResult = await screen.findByText("Review React docs");
      expect(taskResult).toBeInTheDocument();
    });
  });

  describe("R2: SettingsModal Requirements", () => {
    it("should verify that SettingsModal does not render Routing Confidence, NLP for dates, and People Briefings toggles", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
      });
      mockSupabase.from.mockReturnValue(
        mockSupabaseQuery({
          user_id: "user-123",
          routing_confidence: "Medium",
          nlp_date_parsing: true,
          notif_briefing: true,
        }),
      );

      useAppStore.setState({ isSettingsModalOpen: true });

      render(<SettingsModal />, { wrapper });

      await waitFor(() => {
        expect(
          screen.queryByText(/routing confidence/i),
        ).not.toBeInTheDocument();
        expect(screen.queryByText(/nlp date parsing/i)).not.toBeInTheDocument();
      });
    });

    it("groups 'Start breaks automatically' with the focus rhythm settings", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
      });
      mockSupabase.from.mockReturnValue(
        mockSupabaseQuery({
          auto_start_breaks: true,
        }),
      );

      useAppStore.setState({ isSettingsModalOpen: true });

      render(<SettingsModal />, { wrapper });

      await waitFor(() => {
        const focusTab = screen.getByRole("button", { name: /focus/i });
        fireEvent.click(focusTab);
      });

      const rhythmGroup = (await screen.findByText("Rhythm"))
        .closest("section")
        ?.querySelector(".settings-group");
      expect(rhythmGroup).toBeInTheDocument();

      const autoStartToggle = screen.getByRole("switch", {
        name: "Start breaks automatically",
      });
      expect(rhythmGroup).toContainElement(autoStartToggle);
      expect(rhythmGroup).toContainElement(
        screen.getByText("Long break every"),
      );
    });

    it("should verify that the settings tab defaults to the value specified in useAppStore.getState().settingsActiveTab", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
      });
      mockSupabase.from.mockReturnValue(mockSupabaseQuery({}));

      useAppStore.setState({
        isSettingsModalOpen: true,
        settingsActiveTab: "focus",
      });

      render(<SettingsModal />, { wrapper });

      await waitFor(() => {
        const heading = screen.getByRole("heading", { level: 3 });
        expect(heading.textContent).toBe("Focus");
      });
    });
  });

  describe("R3: TaskCard & Think Detail Page Requirements", () => {
    it("should verify that Think thread detail page page transitions/lag are optimized", async () => {
      const prefetchedThread = {
        id: "thread-123",
        title: "Prefetched Thread Title",
        color_accent: "#FBBF24",
        entries: [
          { text: "Initial entry", created_at: new Date().toISOString() },
        ],
        stale_prompt: null,
        status: "active",
        is_pinned: false,
      };

      mockSupabase.from.mockReturnValue(mockSupabaseQuery(prefetchedThread));

      useAppStore.setState({
        prefetchedThreads: { [prefetchedThread.id]: prefetchedThread },
      });

      await act(async () => {
        render(
          <ThreadDetailPage params={Promise.resolve({ id: "thread-123" })} />,
          { wrapper },
        );
      });

      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument();
      const titleInput = await screen.findByDisplayValue(
        "Prefetched Thread Title",
      );
      expect(titleInput).toBeInTheDocument();

      const entryElements = screen.getAllByText("Initial entry");
      expect(entryElements.length).toBeGreaterThan(0);
    });

    it("should verify that the thread color picker is click-triggered on mobile / touch viewports", async () => {
      const originalOntouchstart = window.ontouchstart;
      (window as Window & { ontouchstart?: () => void }).ontouchstart =
        () => {};

      mockSupabase.from.mockReturnValue(
        mockSupabaseQuery({
          id: "thread-123",
          title: "Mobile Thread",
          color_accent: "#FBBF24",
          entries: [],
          stale_prompt: null,
          status: "active",
          is_pinned: false,
        }),
      );

      let container: HTMLElement = document.body;
      await act(async () => {
        const result = render(
          <ThreadDetailPage params={Promise.resolve({ id: "thread-123" })} />,
          { wrapper },
        );
        container = result.container;
      });

      await screen.findByDisplayValue("Mobile Thread");

      const colorBar = container.querySelector(".cursor-pointer");
      expect(colorBar).toBeInTheDocument();

      fireEvent.click(colorBar!);

      const swatches = screen.getAllByRole("button", { name: /^Use colour/ });
      expect(swatches.length).toBeGreaterThan(0);

      if (originalOntouchstart === undefined) {
        delete (window as Window & { ontouchstart?: () => void }).ontouchstart;
      } else {
        window.ontouchstart = originalOntouchstart;
      }
    });
  });
});
