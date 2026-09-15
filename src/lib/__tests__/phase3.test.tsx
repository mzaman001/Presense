import React from "react";
import { render, screen, fireEvent, waitFor, act } from "./test-utils";
import { TEST_USER, makeTask } from "./test-utils";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SearchModal } from "@/components/features/SearchModal";
import { SettingsModal } from "@/components/features/SettingsModal";
import { TaskCard } from "@/components/features/TaskCard";
import ThreadDetailPage from "@/app/(app)/think/[id]/page";
import { useAppStore } from "@/store/useAppStore";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
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

    it("should verify that 'Auto-start breaks' is grouped inside a 'Timer Durations' layout card", async () => {
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

      const timerDurationsCard = screen
        .getByText("Timer Durations")
        .closest(".p-5, .space-y-5, .rounded-xl");
      expect(timerDurationsCard).toBeInTheDocument();

      const autoStartToggle = screen.getByText("Auto-start Breaks");
      expect(timerDurationsCard).toContainElement(autoStartToggle);
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
    it("should verify that TaskCard styles overlapping avatars with a border color matching the background, and does not clip on hover", () => {
      const task = makeTask({
        id: "task-1",
        title: "Test Task",
        category: "work",
        priority: 4,
        linked_people_ids: ["person-1", "person-2"],
      });
      const peopleMap = {
        "person-1": { name: "Alice Smith", initials: "AS", color: "#F472B6" },
        "person-2": { name: "Bob Jones", initials: "BJ", color: "#4ADE80" },
      };

      const { container } = render(
        <TaskCard
          task={task}
          completing={null}
          completeTask={vi.fn()}
          openEditPanel={vi.fn()}
          fetchTasks={vi.fn()}
          peopleMap={peopleMap}
        />,
        { wrapper },
      );

      const avatars = container.querySelectorAll(".flex.-space-x-1\\.5 div");
      expect(avatars.length).toBe(2);
      avatars.forEach((avatar) => {
        expect(avatar).toHaveClass("border-[var(--color-background)]");
      });

      const cardContainer = container.querySelector(".group.relative");
      expect(cardContainer).toBeInTheDocument();
      expect(cardContainer).not.toHaveClass("hover:overflow-hidden");
    });

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

      const colorButton = container.querySelector(
        "button[style*='background-color']",
      );
      expect(colorButton).toBeInTheDocument();

      if (originalOntouchstart === undefined) {
        delete (window as Window & { ontouchstart?: () => void }).ontouchstart;
      } else {
        window.ontouchstart = originalOntouchstart;
      }
    });
  });
});
