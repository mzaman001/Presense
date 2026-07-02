import React, { Suspense } from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractMentions } from "@/lib/utils";
import { CaptureModal } from "@/components/features/CaptureModal";
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
  channel: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  }),
  removeChannel: vi.fn(),
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
    <Suspense fallback={<div data-testid="suspense-loading">Loading...</div>}>
      {children}
    </Suspense>
  </QueryClientProvider>
);

// Helper function to build a chainable Supabase query mock
function mockSupabaseQuery(data: any = null, error: any = null) {
  const query: any = {
    select: vi.fn().mockImplementation(() => query),
    eq: vi.fn().mockImplementation(() => query),
    in: vi.fn().mockImplementation(() => query),
    ilike: vi.fn().mockImplementation(() => query),
    order: vi.fn().mockImplementation(() => query),
    limit: vi.fn().mockImplementation(() => query),
    or: vi.fn().mockImplementation(() => query),
    update: vi.fn().mockImplementation(() => query),
    insert: vi.fn().mockImplementation(() => query),
    delete: vi.fn().mockImplementation(() => query),
    single: vi.fn().mockImplementation(() => query),
    maybeSingle: vi.fn().mockImplementation(() => query),
    then: vi.fn().mockImplementation((onfulfilled) => {
      return Promise.resolve(onfulfilled({ data, error }));
    }),
  };
  query.then = vi.fn().mockImplementation((resolve) => resolve({ data, error }));
  return query;
}

describe("Phase 5 Challenger - Mentions and UI Popover Verification", () => {
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

  describe("1. extractMentions Edge Cases", () => {
    it("handles empty strings and only @ signs", () => {
      expect(extractMentions("")).toEqual([]);
      expect(extractMentions("@")).toEqual([]);
      expect(extractMentions("Hello @ world")).toEqual([]);
    });

    it("handles special characters inside brackets (periods, slashes, etc.)", () => {
      const text1 = "Review by @[Dr. Watson / Chief](550e8400-e29b-41d4-a716-446655440001)";
      expect(extractMentions(text1)).toEqual(["550e8400-e29b-41d4-a716-446655440001"]);

      const text2 = "Assigned to @[Alice-Bob.Jr / Dev-Ops](550e8400-e29b-41d4-a716-446655440002)";
      expect(extractMentions(text2)).toEqual(["550e8400-e29b-41d4-a716-446655440002"]);
    });

    it("handles large numbers of mentions (100+)", () => {
      const uuids: string[] = [];
      const parts: string[] = [];
      for (let i = 1; i <= 120; i++) {
        const id = `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`;
        uuids.push(id);
        parts.push(`@[User ${i}](${id})`);
      }
      const text = parts.join(" and ");
      const results = extractMentions(text);
      expect(results.length).toBe(120);
      expect(results).toEqual(uuids);
    });

    it("evaluates behavior on nested brackets (potential parser limitations)", () => {
      const nestedInNameText = "@[Alice [nested]](550e8400-e29b-41d4-a716-446655440003)";
      expect(extractMentions(nestedInNameText)).toEqual([]);

      const nestedMentionText = "@[Alice @[Bob](550e8400-e29b-41d4-a716-446655440004)](550e8400-e29b-41d4-a716-446655440005)";
      expect(extractMentions(nestedMentionText)).toEqual(["550e8400-e29b-41d4-a716-446655440004"]);
    });
  });

  describe("2. CaptureModal Integration & linked_people mapping", () => {
    const mockPeople = [
      { id: "550e8400-e29b-41d4-a716-446655440010", name: "Alice Smith" },
      { id: "550e8400-e29b-41d4-a716-446655440011", name: "Bob Jones" },
    ];

    it("renders popover on @ character typing and inserts mention on click", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      mockSupabase.from.mockImplementation((table) => {
        if (table === "people") {
          return mockSupabaseQuery(mockPeople);
        }
        return mockSupabaseQuery([]);
      });

      useAppStore.setState({ isCaptureModalOpen: true });

      render(<CaptureModal />, { wrapper });

      const input = screen.getByPlaceholderText(/capture anything/i) as HTMLInputElement;
      expect(input).toBeInTheDocument();

      fireEvent.change(input, { target: { value: "Call @" } });

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith("people");
      });

      const popover = await screen.findByTestId("mentions-popover");
      expect(popover).toBeInTheDocument();
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();

      // Click "Alice Smith"
      const aliceBtn = screen.getByText("Alice Smith");
      fireEvent.click(aliceBtn);

      expect(screen.queryByTestId("mentions-popover")).not.toBeInTheDocument();
      expect(input.value).toBe("Call @[Alice Smith](550e8400-e29b-41d4-a716-446655440010) ");
    });

    it("correctly maps mentioned UUID to linked_people in database insert on confirm (Do/Inbox destination)", async () => {
      const mockInsert = vi.fn().mockReturnValue(mockSupabaseQuery({ success: true }));
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      mockSupabase.from.mockImplementation((table) => {
        if (table === "people") {
          return mockSupabaseQuery(mockPeople);
        }
        if (table === "items") {
          return { insert: mockInsert };
        }
        return mockSupabaseQuery([]);
      });

      useAppStore.setState({ isCaptureModalOpen: true });
      const { container } = render(<CaptureModal />, { wrapper });

      const input = screen.getByPlaceholderText(/capture anything/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "Call @[Alice Smith](550e8400-e29b-41d4-a716-446655440010) tomorrow" } });

      // Mock the API response for routing
      const mockFetch = vi.spyOn(window, "fetch").mockResolvedValue({
        json: () => Promise.resolve({
          items: [
            {
              type: "task",
              title: "Call @[Alice Smith](550e8400-e29b-41d4-a716-446655440010) tomorrow",
              destination: "Do",
              deadline: new Date().toISOString(),
            }
          ]
        })
      } as any);

      // Trigger Route
      const routeBtn = screen.getByRole("button", { name: /route/i });
      fireEvent.click(routeBtn);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      // Confirm and save
      const saveBtn = await screen.findByRole("button", { name: /confirm/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({
            linked_people_ids: ["550e8400-e29b-41d4-a716-446655440010"],
            title: "Call @[Alice Smith](550e8400-e29b-41d4-a716-446655440010) tomorrow",
          })
        );
      });

      mockFetch.mockRestore();
    });

    it("correctly maps mentioned UUID to linked_people in database insert on confirm (Think destination)", async () => {
      const mockInsert = vi.fn().mockReturnValue(mockSupabaseQuery({ success: true }));
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      mockSupabase.from.mockImplementation((table) => {
        if (table === "people") {
          return mockSupabaseQuery(mockPeople);
        }
        if (table === "threads") {
          return { insert: mockInsert };
        }
        return mockSupabaseQuery([]);
      });

      useAppStore.setState({ isCaptureModalOpen: true });
      render(<CaptureModal />, { wrapper });

      const input = screen.getByPlaceholderText(/capture anything/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "Idea about @[Bob Jones](550e8400-e29b-41d4-a716-446655440011)" } });

      const mockFetch = vi.spyOn(window, "fetch").mockResolvedValue({
        json: () => Promise.resolve({
          items: [
            {
              type: "thought",
              title: "Idea about @[Bob Jones](550e8400-e29b-41d4-a716-446655440011)",
              destination: "Think",
            }
          ]
        })
      } as any);

      // Trigger Route
      const routeBtn = screen.getByRole("button", { name: /route/i });
      fireEvent.click(routeBtn);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      // Confirm and save
      const saveBtn = await screen.findByRole("button", { name: /confirm/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith(
          expect.objectContaining({
            linked_people_ids: ["550e8400-e29b-41d4-a716-446655440011"],
          })
        );
      });

      mockFetch.mockRestore();
    });
  });

  describe("3. Think Space Entry Add/Delete Aggregation", () => {
    const mockPeople = [
      { id: "550e8400-e29b-41d4-a716-446655440010", name: "Alice Smith" },
      { id: "550e8400-e29b-41d4-a716-446655440011", name: "Bob Jones" },
    ];

    it("aggregates and updates list of unique UUIDs in the database when entries are added or deleted", async () => {
      const initialThread = {
        id: "thread-123",
        title: "Project Brainstorm",
        color_accent: "#FBBF24",
        entries: [
          { text: "We need to talk to @[Alice Smith](550e8400-e29b-41d4-a716-446655440010)", created_at: new Date().toISOString() }
        ],
        stale_prompt: null,
        status: "active",
        is_pinned: false,
      };

      const mockUpdate = vi.fn().mockReturnValue(mockSupabaseQuery({ success: true }));

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      
      mockSupabase.from.mockImplementation((table) => {
        if (table === "people") {
          return mockSupabaseQuery(mockPeople);
        }
        if (table === "threads") {
          const query = mockSupabaseQuery(initialThread);
          query.update = mockUpdate;
          return query;
        }
        return mockSupabaseQuery([]);
      });

      useAppStore.setState({
        prefetchedThreads: { "thread-123": initialThread },
      });

      // Render ThreadDetailPage
      await act(async () => {
        render(<ThreadDetailPage params={Promise.resolve({ id: "thread-123" })} />, { wrapper });
      });

      // Wait for thread to load
      const titleInput = await screen.findByDisplayValue("Project Brainstorm");
      expect(titleInput).toBeInTheDocument();

      // Add a new entry mentioning both people again
      const textarea = screen.getByPlaceholderText(/continue the thought/i);
      fireEvent.change(textarea, { target: { value: "Follow up with @[Bob Jones](550e8400-e29b-41d4-a716-446655440011) and @[Alice Smith](550e8400-e29b-41d4-a716-446655440010)" } });

      const submitBtn = textarea.closest("form")!.querySelector('button[type="submit"]') as HTMLButtonElement;
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            linked_people_ids: expect.arrayContaining([
              "550e8400-e29b-41d4-a716-446655440010",
              "550e8400-e29b-41d4-a716-446655440011",
            ]),
            entries: expect.arrayContaining([
              expect.objectContaining({ text: "We need to talk to @[Alice Smith](550e8400-e29b-41d4-a716-446655440010)" }),
              expect.objectContaining({ text: "Follow up with @[Bob Jones](550e8400-e29b-41d4-a716-446655440011) and @[Alice Smith](550e8400-e29b-41d4-a716-446655440010)" }),
            ]),
          })
        );
        expect(mockUpdate.mock.calls[0][0].linked_people_ids.length).toBe(2);
      });

      mockUpdate.mockClear();

      const threadWithTwoEntries = {
        ...initialThread,
        entries: [
          { text: "We need to talk to @[Alice Smith](550e8400-e29b-41d4-a716-446655440010)", created_at: new Date().toISOString() },
          { text: "Follow up with @[Bob Jones](550e8400-e29b-41d4-a716-446655440011)", created_at: new Date().toISOString() }
        ]
      };

      useAppStore.setState({
        prefetchedThreads: { "thread-123": threadWithTwoEntries },
      });

      mockSupabase.from.mockImplementation((table) => {
        if (table === "people") {
          return mockSupabaseQuery(mockPeople);
        }
        if (table === "threads") {
          const query = mockSupabaseQuery(threadWithTwoEntries);
          query.update = mockUpdate;
          return query;
        }
        return mockSupabaseQuery([]);
      });

      await act(async () => {
        render(<ThreadDetailPage params={Promise.resolve({ id: "thread-123" })} />, { wrapper });
      });
      await screen.findByDisplayValue("Project Brainstorm");

      const deleteButtons = screen.getAllByTitle("Delete entry");
      expect(deleteButtons.length).toBe(2);

      fireEvent.click(deleteButtons[0]);

      const confirmDeleteBtn = await screen.findByRole("button", { name: "Delete" });
      fireEvent.click(confirmDeleteBtn);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            linked_people_ids: ["550e8400-e29b-41d4-a716-446655440011"],
            entries: [
              expect.objectContaining({ text: "Follow up with @[Bob Jones](550e8400-e29b-41d4-a716-446655440011)" })
            ],
          })
        );
      });
    });
  });
});
