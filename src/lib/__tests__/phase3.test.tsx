import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExploreDrawer } from "@/components/features/ExploreDrawer";
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
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

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
  function mockSupabaseQuery(data: any = null, error: any = null) {
    const query: any = {
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
    query.then = vi.fn().mockImplementation((resolve) => resolve({ data, error }));
    return query;
  }

  describe("R1: ExploreDrawer & SearchModal Requirements", () => {
    it("should verify that ExploreDrawer only uses and exposes system types (link, note, book) and does not allow creating custom types", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      mockSupabase.from.mockReturnValue(mockSupabaseQuery([]));

      const onClose = vi.fn();
      const onSaved = vi.fn();

      render(
        <ExploreDrawer
          isOpen={true}
          onClose={onClose}
          onSaved={onSaved}
          item={null}
        />,
        { wrapper }
      );

      // Verify preset types dropdown button is present
      const typeButton = screen.getByRole("button", { name: /link/i });
      expect(typeButton).toBeInTheDocument();

      // Open the dropdown
      fireEvent.click(typeButton);

      // Verify only system types (link, note, book) are present in the dropdown list
      const linkOption = screen.getByRole("button", { name: /^link$/i });
      const noteOption = screen.getByRole("button", { name: /^note$/i });
      const bookOption = screen.getByRole("button", { name: /^book$/i });

      expect(linkOption).toBeInTheDocument();
      expect(noteOption).toBeInTheDocument();
      expect(bookOption).toBeInTheDocument();

      // Verify that no input field or button to create/add a custom type is rendered
      const allInputs = screen.getAllByRole("textbox");
      const customTypeInput = allInputs.find((input: any) => 
        input.placeholder?.toLowerCase().includes("type") || 
        input.name?.toLowerCase().includes("type")
      );
      expect(customTypeInput).toBeUndefined();
    });

    it("should verify that SearchModal supports searching items by categories and explores by tags", async () => {
      useAppStore.setState({ isSearchModalOpen: true });

      // Mock search response for items by category & explores by tags
      mockSupabase.from.mockImplementation((table) => {
        if (table === "items") {
          return mockSupabaseQuery([
            { id: "task-1", title: "Review React docs", category: "study" },
          ]);
        }
        if (table === "explores") {
          return mockSupabaseQuery([
            { id: "explore-1", title: "Atomic Habits", tags: ["book", "productivity"] },
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

      // Trigger searching by tags
      fireEvent.change(searchInput, { target: { value: "productivity" } });

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith("explores");
      });

      const exploreResult = await screen.findByText("Atomic Habits");
      expect(exploreResult).toBeInTheDocument();
    });
  });

  describe("R2: SettingsModal Requirements", () => {
    it("should verify that SettingsModal does not render Routing Confidence, NLP for dates, and People Briefings toggles", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
      });
      mockSupabase.from.mockReturnValue(mockSupabaseQuery({
        user_id: "user-123",
        routing_confidence: "Medium",
        nlp_date_parsing: true,
        notif_briefing: true,
      }));

      useAppStore.setState({ isSettingsModalOpen: true });

      render(<SettingsModal />, { wrapper });

      await waitFor(() => {
        expect(screen.queryByText(/routing confidence/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/nlp date parsing/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/people briefings/i)).not.toBeInTheDocument();
      });
    });

    it("should verify that 'Auto-start breaks' is grouped inside a 'Timer Durations' layout card", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
      });
      mockSupabase.from.mockReturnValue(mockSupabaseQuery({
        auto_start_breaks: true,
      }));

      useAppStore.setState({ isSettingsModalOpen: true });

      render(<SettingsModal />, { wrapper });

      await waitFor(() => {
        const focusTab = screen.getByRole("button", { name: /focus/i });
        fireEvent.click(focusTab);
      });

      const timerDurationsCard = screen.getByText("Timer Durations").closest("div");
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
        settingsActiveTab: "focus" as any 
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
      const task = {
        id: "task-1",
        title: "Test Task",
        category: "work",
        priority: 4,
        linked_people_ids: ["person-1", "person-2"],
      };
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
        { wrapper }
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
        entries: [{ text: "Initial entry", created_at: new Date().toISOString() }],
        stale_prompt: null,
        status: "active",
        is_pinned: false,
      };
      
      useAppStore.setState({ prefetchedThreads: { [prefetchedThread.id]: prefetchedThread } });

      render(
        <ThreadDetailPage params={Promise.resolve({ id: "thread-123" })} />,
        { wrapper }
      );

      expect(screen.queryByTestId("loading-spinner")).not.toBeInTheDocument();
      expect(screen.getByDisplayValue("Prefetched Thread Title")).toBeInTheDocument();

      const entryElements = screen.getAllByText("Initial entry");
      expect(entryElements.length).toBeGreaterThan(0);
    });

    it("should verify that the thread color picker is click-triggered on mobile / touch viewports", async () => {
      const originalOntouchstart = window.ontouchstart;
      (window as any).ontouchstart = () => {};

      mockSupabase.from.mockReturnValue(mockSupabaseQuery({
        id: "thread-123",
        title: "Mobile Thread",
        color_accent: "#FBBF24",
        entries: [],
        stale_prompt: null,
        status: "active",
        is_pinned: false,
      }));

      const { container } = render(
        <ThreadDetailPage params={Promise.resolve({ id: "thread-123" })} />,
        { wrapper }
      );

      await screen.findByDisplayValue("Mobile Thread");

      const colorBar = container.querySelector(".cursor-pointer");
      expect(colorBar).toBeInTheDocument();

      fireEvent.click(colorBar!);

      const colorButton = container.querySelector("button[style*='background-color']");
      expect(colorButton).toBeInTheDocument();

      if (originalOntouchstart === undefined) {
        delete (window as any).ontouchstart;
      } else {
        window.ontouchstart = originalOntouchstart;
      }
    });
  });
});
