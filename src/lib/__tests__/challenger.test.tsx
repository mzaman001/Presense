import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
      const text1 = "Review by @[Dr. Watson / Chief](uuid.1/watson)";
      expect(extractMentions(text1)).toEqual(["uuid.1/watson"]);

      const text2 = "Assigned to @[Alice-Bob.Jr / Dev-Ops](dev.ops/alice-bob)";
      expect(extractMentions(text2)).toEqual(["dev.ops/alice-bob"]);
    });

    it("handles large numbers of mentions (100+)", () => {
      const uuids: string[] = [];
      const parts: string[] = [];
      for (let i = 1; i <= 120; i++) {
        const id = `user-uuid-${i}`;
        uuids.push(id);
        parts.push(`@[User ${i}](${id})`);
      }
      const text = parts.join(" and ");
      const results = extractMentions(text);
      expect(results.length).toBe(120);
      expect(results).toEqual(uuids);
    });

    it("evaluates behavior on nested brackets (potential parser limitations)", () => {
      // 1. Nested brackets in display name: @[Alice [nested]](uuid-alice)
      // Because the regex matches [^\]]+ inside the display name, it stops at the first closing bracket.
      // So it will see @[Alice [nested] as incomplete/not matching the pattern since the subsequent characters are '](uuid-alice)'.
      const nestedInNameText = "@[Alice [nested]](uuid-alice)";
      expect(extractMentions(nestedInNameText)).toEqual([]); // Fails to extract

      // 2. Nested bracket with nested mention syntax: @[Alice @[Bob](uuid-bob)](uuid-alice)
      // The inner mention has its own bracket structure, so the regex stops at the first ']' which belongs to Bob.
      // It matches @[Alice @[Bob](uuid-bob) and captures 'uuid-bob'.
      // The outer wrapper '](uuid-alice)' is left dangling.
      const nestedMentionText = "@[Alice @[Bob](uuid-bob)](uuid-alice)";
      expect(extractMentions(nestedMentionText)).toEqual(["uuid-bob"]);
    });
  });

  describe("2. CaptureModal Integration & linked_people mapping", () => {
    const mockPeople = [
      { id: "person-1", name: "Alice Smith" },
      { id: "person-2", name: "Bob Jones" },
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

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith("people");
      });

      const input = screen.getByPlaceholderText(/capture anything/i) as HTMLInputElement;
      expect(input).toBeInTheDocument();

      // Type "@" to trigger popover
      fireEvent.change(input, { target: { value: "Call @" } });

      const popover = await screen.findByTestId("mentions-popover");
      expect(popover).toBeInTheDocument();
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();

      // Click "Alice Smith"
      const aliceBtn = screen.getByText("Alice Smith");
      fireEvent.click(aliceBtn);

      expect(screen.queryByTestId("mentions-popover")).not.toBeInTheDocument();
      expect(input.value).toBe("Call @[Alice Smith](person-1) ");
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
      fireEvent.change(input, { target: { value: "Call @[Alice Smith](person-1) tomorrow" } });

      // Mock the API response for routing
      const mockFetch = vi.spyOn(window, "fetch").mockResolvedValue({
        json: () => Promise.resolve({
          items: [
            {
              type: "task",
              title: "Call @[Alice Smith](person-1) tomorrow",
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
            linked_people: ["person-1"],
            title: "Call @[Alice Smith](person-1) tomorrow",
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
      fireEvent.change(input, { target: { value: "Idea about @[Bob Jones](person-2)" } });

      const mockFetch = vi.spyOn(window, "fetch").mockResolvedValue({
        json: () => Promise.resolve({
          items: [
            {
              type: "thought",
              title: "Idea about @[Bob Jones](person-2)",
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
            linked_people: ["person-2"],
            title: "Idea about @[Bob Jones](person-2)",
          })
        );
      });

      mockFetch.mockRestore();
    });
  });

  describe("3. Think Space Entry Add/Delete Aggregation", () => {
    const mockPeople = [
      { id: "person-1", name: "Alice Smith" },
      { id: "person-2", name: "Bob Jones" },
    ];

    it("aggregates and updates list of unique UUIDs in the database when entries are added or deleted", async () => {
      const initialThread = {
        id: "thread-123",
        title: "Project Brainstorm",
        color_accent: "#FBBF24",
        entries: [
          { text: "We need to talk to @[Alice Smith](person-1)", created_at: new Date().toISOString() }
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

      // Render ThreadDetailPage
      render(<ThreadDetailPage params={Promise.resolve({ id: "thread-123" })} />, { wrapper });

      // Wait for thread to load
      const titleInput = await screen.findByDisplayValue("Project Brainstorm");
      expect(titleInput).toBeInTheDocument();

      // Add a new entry mentioning person-2 and person-1 again
      const textarea = screen.getByPlaceholderText(/continue the thought/i);
      fireEvent.change(textarea, { target: { value: "Follow up with @[Bob Jones](person-2) and @[Alice Smith](person-1)" } });

      const submitBtn = screen.getByRole("button", { type: "submit" });
      fireEvent.click(submitBtn);

      // Verify that database update was called with the combined unique mentions array: ["person-1", "person-2"]
      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            linked_people: expect.arrayContaining(["person-1", "person-2"]),
            entries: expect.arrayContaining([
              expect.objectContaining({ text: "We need to talk to @[Alice Smith](person-1)" }),
              expect.objectContaining({ text: "Follow up with @[Bob Jones](person-2) and @[Alice Smith](person-1)" }),
            ]),
          })
        );
        expect(mockUpdate.mock.calls[0][0].linked_people.length).toBe(2); // Verify uniqueness
      });

      // Now test deleting an entry
      // Clear mocks to focus on deletion
      mockUpdate.mockClear();

      // Let's reload / set thread state inside the mock to simulate that the state has the 2 entries now
      const threadWithTwoEntries = {
        ...initialThread,
        entries: [
          { text: "We need to talk to @[Alice Smith](person-1)", created_at: new Date().toISOString() },
          { text: "Follow up with @[Bob Jones](person-2)", created_at: new Date().toISOString() }
        ]
      };

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

      // Rerender page to show the two entries
      const { container } = render(<ThreadDetailPage params={Promise.resolve({ id: "thread-123" })} />, { wrapper });
      await screen.findByDisplayValue("Project Brainstorm");

      // Find the first delete entry button (belonging to Alice's entry)
      const deleteButtons = screen.getAllByTitle("Delete entry");
      expect(deleteButtons.length).toBe(2);

      // Click delete on the first entry (Alice)
      fireEvent.click(deleteButtons[0]);

      // Click confirm in the ConfirmModal
      const confirmDeleteBtn = await screen.findByRole("button", { name: "Delete" });
      fireEvent.click(confirmDeleteBtn);

      // Verify database update is called with only the second entry and only ["person-2"] as linked_people
      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            linked_people: ["person-2"],
            entries: [
              expect.objectContaining({ text: "Follow up with @[Bob Jones](person-2)" })
            ],
          })
        );
      });
    });
  });
});
