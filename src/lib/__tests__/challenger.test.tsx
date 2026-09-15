import React, { Suspense } from "react";
import { render, screen, fireEvent, waitFor, act } from "./test-utils";
import { TEST_USER } from "./test-utils";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { describe, it, expect, vi, beforeEach } from "vitest";
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
  <SessionProvider user={TEST_USER}>
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div data-testid="suspense-loading">Loading...</div>}>
        {children}
      </Suspense>
    </QueryClientProvider>
  </SessionProvider>
);

/**
 * A chainable Supabase query stub: every builder method returns the same
 * object, and awaiting it resolves to { data, error }.
 */
type MockQuery = Record<string, ReturnType<typeof vi.fn>> & {
  then: ReturnType<typeof vi.fn>;
};

// Helper function to build a chainable Supabase query mock
function mockSupabaseQuery(
  data: unknown = null,
  error: unknown = null,
): MockQuery {
  const query: MockQuery = {
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
  query.then = vi
    .fn()
    .mockImplementation((resolve) => resolve({ data, error }));
  return query;
}

describe("Phase 5 Challenger - Think Thread Entry Persistence", () => {
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

  describe("Think Space Entry Add/Delete", () => {
    it("persists an entries array with both the original and new entry when adding, and with the deleted entry filtered out when deleting", async () => {
      const initialThread = {
        id: "thread-123",
        title: "Project Brainstorm",
        color_accent: "#FBBF24",
        entries: [
          {
            text: "First thought",
            created_at: new Date().toISOString(),
          },
        ],
        stale_prompt: null,
        status: "active",
        is_pinned: false,
      };

      const mockUpdate = vi
        .fn()
        .mockReturnValue(mockSupabaseQuery({ success: true }));

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });

      mockSupabase.from.mockImplementation((table) => {
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

      let unmount: () => void;
      // Render ThreadDetailPage
      await act(async () => {
        const res = render(
          <ThreadDetailPage params={Promise.resolve({ id: "thread-123" })} />,
          { wrapper },
        );
        unmount = res.unmount;
      });

      // Wait for thread to load
      const titleInput = await screen.findByDisplayValue("Project Brainstorm");
      expect(titleInput).toBeInTheDocument();

      // Add a new entry
      const textarea = screen.getByPlaceholderText(/continue the thought/i);
      fireEvent.change(textarea, {
        target: { value: "Second thought" },
      });

      const submitBtn = textarea
        .closest("form")!
        .querySelector('button[type="submit"]') as HTMLButtonElement;
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            entries: expect.arrayContaining([
              expect.objectContaining({ text: "First thought" }),
              expect.objectContaining({ text: "Second thought" }),
            ]),
          }),
        );
        expect(mockUpdate.mock.calls[0][0].entries.length).toBe(2);
      });

      mockUpdate.mockClear();

      const threadWithTwoEntries = {
        ...initialThread,
        entries: [
          {
            text: "First thought",
            created_at: new Date().toISOString(),
          },
          {
            text: "Second thought",
            created_at: new Date().toISOString(),
          },
        ],
      };

      useAppStore.setState({
        prefetchedThreads: { "thread-123": threadWithTwoEntries },
      });

      mockSupabase.from.mockImplementation((table) => {
        if (table === "threads") {
          const query = mockSupabaseQuery(threadWithTwoEntries);
          query.update = mockUpdate;
          return query;
        }
        return mockSupabaseQuery([]);
      });

      await act(async () => {
        unmount();
        render(
          <ThreadDetailPage params={Promise.resolve({ id: "thread-123" })} />,
          { wrapper },
        );
      });
      await screen.findByDisplayValue("Project Brainstorm");

      // Exactly one delete button per entry
      const deleteButtons = screen.getAllByTitle("Delete entry");
      expect(deleteButtons.length).toBe(2);

      fireEvent.click(deleteButtons[0]);

      const confirmDeleteBtn = await screen.findByRole("button", {
        name: "Delete",
      });
      fireEvent.click(confirmDeleteBtn);

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            entries: [expect.objectContaining({ text: "Second thought" })],
          }),
        );
      });
    });
  });
});
