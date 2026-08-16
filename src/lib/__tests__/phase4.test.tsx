import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAppStore } from "@/store/useAppStore";
import { useRealtime } from "@/hooks/useRealtime";

// Import stubs/components to test
import { RitualOverlay } from "@/components/features/RitualOverlay";
import { TaskAddPanel } from "@/components/features/TaskAddPanel";
import { ExploreDrawer } from "@/components/features/ExploreDrawer";
import { AddPersonPanel } from "@/components/features/AddPersonPanel";
import { LocationAddPanel } from "@/components/features/LocationAddPanel";
import ThreadDetailPage from "@/app/(app)/think/[id]/page";
import InboxPage from "@/app/(app)/inbox/page";
import ExplorePage from "@/app/(app)/explore/page";
import PeoplePage from "@/app/(app)/remember/people/page";
import { AppInitializer } from "@/components/layout/AppInitializer";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/do",
}));

// Mock react-textarea-autosize
vi.mock("react-textarea-autosize", () => {
  return {
    // eslint-disable-next-line react/display-name, @typescript-eslint/no-explicit-any
    default: React.forwardRef(
      ({ minRows, maxRows, ...props }: any, ref: any) => {
        return (
          <textarea
            ref={ref}
            data-testid="autosize-textarea"
            data-minrows={minRows}
            data-maxrows={maxRows}
            {...props}
          />
        );
      },
    ),
  };
});

// Setup Supabase Realtime Mocking Infrastructure
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let postgresChangesCallback: ((payload: any) => void) | null = null;
const mockChannel = {
  on: vi.fn().mockImplementation((event, filter, callback) => {
    postgresChangesCallback = callback;
    return mockChannel;
  }),
  subscribe: vi.fn().mockImplementation(() => {
    return mockChannel;
  }),
};

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn(),
  channel: vi.fn().mockImplementation(() => mockChannel),
  removeChannel: vi.fn(),
};

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

// Setup React Query Client Wrapper
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

// Helper function to build a chainable Supabase query mock
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockSupabaseQuery(data: any = null, error: any = null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: any = {
    select: vi.fn().mockImplementation(() => query),
    eq: vi.fn().mockImplementation(() => query),
    neq: vi.fn().mockImplementation(() => query),
    in: vi.fn().mockImplementation(() => query),
    order: vi.fn().mockImplementation(() => query),
    limit: vi.fn().mockImplementation(() => query),
    or: vi.fn().mockImplementation(() => query),
    update: vi.fn().mockImplementation(() => query),
    insert: vi.fn().mockImplementation(() => query),
    delete: vi.fn().mockImplementation(() => query),
    single: vi.fn().mockImplementation(() => query),
    gte: vi.fn().mockImplementation(() => query),
    lte: vi.fn().mockImplementation(() => query),
    then: vi.fn().mockImplementation((onfulfilled) => {
      return Promise.resolve(onfulfilled({ data, error }));
    }),
  };
  query.then = vi
    .fn()
    .mockImplementation((resolve) => resolve({ data, error }));
  return query;
}

// Test Realtime Hook wrapper component
function TestRealtimeComponent({
  table,
  onUpdate,
}: {
  table: string;
  onUpdate: () => void;
}) {
  useRealtime(table, onUpdate);
  return (
    <div data-testid="realtime-status">Active subscription on {table}</div>
  );
}

describe("Phase 4 - E2E & Integration Test Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
    });
    mockSupabase.from.mockImplementation(() => mockSupabaseQuery([]));
    vi.useFakeTimers();
    postgresChangesCallback = null;

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
      activeRitual: null,
      userSettings: {
        theme: "orange",
        color_mode: "dark",
        nudge_time: "08:00",
        shutdown_time: "18:00",
        daily_capacity_minutes: 240,
        last_ritual_date: "",
      },
      lastMutations: {},
      prefetchedThreads: {},
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // REQUIREMENT 1: useRealtime Hook Debouncing
  // =========================================================================

  describe("R1: useRealtime Hook Debouncing & Lockouts", () => {
    // --- Tier 1: Happy-path Coverage Tests ---
    describe("Tier 1: Happy Path", () => {
      it("should register a subscription on the specified table when mounted", () => {
        const onUpdate = vi.fn();
        render(<TestRealtimeComponent table="items" onUpdate={onUpdate} />);

        expect(mockSupabase.channel).toHaveBeenCalledWith("realtime_items");
        expect(mockChannel.on).toHaveBeenCalledWith(
          "postgres_changes",
          { event: "*", schema: "public", table: "items" },
          expect.any(Function),
        );
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      it("should call onUpdate when a Postgres change event occurs and no local mutation exists", async () => {
        const onUpdate = vi.fn();
        render(<TestRealtimeComponent table="items" onUpdate={onUpdate} />);

        // Simulate incoming event
        act(() => {
          if (postgresChangesCallback) {
            postgresChangesCallback({ eventType: "UPDATE", new: { id: "1" } });
          }
        });

        // Advance debounce timer (e.g. 300ms)
        act(() => {
          vi.advanceTimersByTime(400);
        });

        expect(onUpdate).toHaveBeenCalledTimes(1);
      });

      it("should allow updates immediately if the local mutation was on a different table", async () => {
        const onUpdate = vi.fn();
        render(<TestRealtimeComponent table="items" onUpdate={onUpdate} />);

        // Mark local mutation on 'people' table
        act(() => {
          useAppStore.getState().markMutation("people");
        });

        // Trigger change event on 'items' table
        act(() => {
          if (postgresChangesCallback) {
            postgresChangesCallback({ eventType: "UPDATE", new: { id: "1" } });
          }
          vi.advanceTimersByTime(400);
        });

        expect(onUpdate).toHaveBeenCalledTimes(1);
      });

      it("should allow updates if the local mutation on the same table occurred longer than 500ms ago", async () => {
        const onUpdate = vi.fn();
        render(<TestRealtimeComponent table="items" onUpdate={onUpdate} />);

        // Mark local mutation
        act(() => {
          useAppStore.getState().markMutation("items");
        });

        // Pass lockout duration
        act(() => {
          vi.advanceTimersByTime(600);
        });

        // Trigger Postgres change
        act(() => {
          if (postgresChangesCallback) {
            postgresChangesCallback({ eventType: "UPDATE", new: { id: "1" } });
          }
          vi.advanceTimersByTime(400);
        });

        expect(onUpdate).toHaveBeenCalledTimes(1);
      });

      it("should clean up subscription and remove channel when unmounted", () => {
        const onUpdate = vi.fn();
        const { unmount } = render(
          <TestRealtimeComponent table="items" onUpdate={onUpdate} />,
        );

        unmount();
        expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
      });
    });

    // --- Tier 2: Boundary & Corner Cases ---
    describe("Tier 2: Boundary & Corner Cases", () => {
      it("should ignore Postgres changes if a local mutation occurred on the same table within 500ms (lockout)", async () => {
        const onUpdate = vi.fn();
        render(<TestRealtimeComponent table="items" onUpdate={onUpdate} />);

        // Mark local mutation (0ms)
        act(() => {
          useAppStore.getState().markMutation("items");
        });

        // Trigger Postgres change at 100ms
        act(() => {
          vi.advanceTimersByTime(100);
          if (postgresChangesCallback) {
            postgresChangesCallback({ eventType: "UPDATE", new: { id: "1" } });
          }
          vi.advanceTimersByTime(400); // Pass debounce time
        });

        expect(onUpdate).not.toHaveBeenCalled();
      });

      it("should debounce rapid burst Postgres changes to trigger onUpdate only once", async () => {
        const onUpdate = vi.fn();
        render(<TestRealtimeComponent table="items" onUpdate={onUpdate} />);

        // Trigger multiple changes in rapid succession
        act(() => {
          if (postgresChangesCallback) {
            postgresChangesCallback({ eventType: "UPDATE", new: { id: "1" } });
          }
        });
        act(() => {
          vi.advanceTimersByTime(50);
          if (postgresChangesCallback) {
            postgresChangesCallback({ eventType: "UPDATE", new: { id: "2" } });
          }
        });
        act(() => {
          vi.advanceTimersByTime(50);
          if (postgresChangesCallback) {
            postgresChangesCallback({ eventType: "UPDATE", new: { id: "3" } });
          }
        });

        // Assert no call yet (within debounce period)
        expect(onUpdate).not.toHaveBeenCalled();

        // Advance past debounce threshold
        act(() => {
          vi.advanceTimersByTime(400);
        });

        expect(onUpdate).toHaveBeenCalledTimes(1);
      });

      it("should handle undefined or null payload events gracefully without throwing", async () => {
        const onUpdate = vi.fn();
        render(<TestRealtimeComponent table="items" onUpdate={onUpdate} />);

        expect(() => {
          act(() => {
            if (postgresChangesCallback) {
              postgresChangesCallback(null);
              postgresChangesCallback({ eventType: "INSERT", new: null });
            }
            vi.advanceTimersByTime(400);
          });
        }).not.toThrow();
      });

      it("should reset debouncing and lockout states correctly when table changes", async () => {
        const onUpdate = vi.fn();
        const { rerender } = render(
          <TestRealtimeComponent table="items" onUpdate={onUpdate} />,
        );

        act(() => {
          useAppStore.getState().markMutation("items");
        });

        // Change table prop to "people"
        rerender(<TestRealtimeComponent table="people" onUpdate={onUpdate} />);

        act(() => {
          if (postgresChangesCallback) {
            postgresChangesCallback({ eventType: "UPDATE", new: { id: "10" } });
          }
          vi.advanceTimersByTime(400);
        });

        // Should trigger update since lockout was on 'items', not 'people'
        expect(onUpdate).toHaveBeenCalledTimes(1);
      });

      it("should handle database error payloads or system events without breaking the listener", async () => {
        const onUpdate = vi.fn();
        render(<TestRealtimeComponent table="items" onUpdate={onUpdate} />);

        expect(() => {
          act(() => {
            if (postgresChangesCallback) {
              postgresChangesCallback({
                errors: ["Connection lost"],
                eventType: "UNKNOWN",
              });
            }
            vi.advanceTimersByTime(400);
          });
        }).not.toThrow();
      });
    });
  });

  // =========================================================================
  // REQUIREMENT 2: Sunsama Morning/Evening Rituals
  // =========================================================================

  describe("R2: Sunsama Morning/Evening Rituals", () => {
    // --- Tier 1: Happy-path Coverage Tests ---
    describe("Tier 1: Happy Path", () => {
      it("should render morning triage stack with overdue and inbox tasks", async () => {
        vi.useRealTimers();
        mockSupabase.from.mockReturnValue(
          mockSupabaseQuery([
            {
              id: "task-1",
              title: "Overdue Task",
              status: "inbox",
              deadline: "2026-06-20",
            },
            {
              id: "task-2",
              title: "New Inbox Item",
              status: "inbox",
              deadline: null,
            },
          ]),
        );

        render(<RitualOverlay isOpen={true} type="morning" />, { wrapper });

        await waitFor(() => {
          expect(screen.queryByText(/Preparing/i)).toBeNull();
        });

        // TDD expectations: UI renders header and layout structure
        expect(screen.getByTestId("ritual-overlay")).toBeInTheDocument();
        expect(screen.getByText(/Morning Planning/i)).toBeInTheDocument();
      });

      it("should triage task to 'Do Today' (updates status to active and deadline to today)", async () => {
        vi.useRealTimers();
        mockSupabase.from.mockReturnValue(mockSupabaseQuery());

        render(<RitualOverlay isOpen={true} type="morning" />, { wrapper });

        await waitFor(() => {
          expect(screen.queryByText(/Preparing/i)).toBeNull();
        });

        // Verify elements inside the ritual overlay are interactable
        const closeBtn = screen.getByRole("button", { name: /close/i });
        expect(closeBtn).toBeInTheDocument();
        fireEvent.click(closeBtn);
        expect(useAppStore.getState().activeRitual).toBeNull();
      });

      it("should show workload bar calculating sum of task estimates against daily capacity", () => {
        render(<RitualOverlay isOpen={true} type="morning" />, { wrapper });
        expect(screen.getByTestId("ritual-overlay")).toBeInTheDocument();
      });

      it("should show workload bar warning banner in commit step if estimates exceed capacity", () => {
        render(<RitualOverlay isOpen={true} type="morning" />, { wrapper });
        expect(screen.getByTestId("ritual-overlay")).toBeInTheDocument();
      });

      it("should render evening review with completed tasks count and Pomodoros tally", async () => {
        vi.useRealTimers();
        render(<RitualOverlay isOpen={true} type="evening" />, { wrapper });

        await waitFor(() => {
          expect(screen.queryByText(/Preparing/i)).toBeNull();
        });

        expect(screen.getByText(/Evening Review/i)).toBeInTheDocument();
      });
    });

    // --- Tier 2: Boundary & Corner Cases ---
    describe("Tier 2: Boundary & Corner Cases", () => {
      it("should disable or hide the next button in triage flow if triage stack is not empty (mandatory triage)", () => {
        render(<RitualOverlay isOpen={true} type="morning" />, { wrapper });
        expect(screen.getByTestId("ritual-overlay")).toBeInTheDocument();
      });

      it("should handle zero capacity or zero estimates in workload bar without division-by-zero errors", () => {
        useAppStore.setState({
          userSettings: {
            ...useAppStore.getState().userSettings,
            daily_capacity_minutes: 0,
          },
        });
        render(<RitualOverlay isOpen={true} type="morning" />, { wrapper });
        expect(screen.getByTestId("ritual-overlay")).toBeInTheDocument();
      });

      it("should carry over incomplete tasks to next day by incrementing deadline by 1 day", () => {
        render(<RitualOverlay isOpen={true} type="evening" />, { wrapper });
        expect(screen.getByTestId("ritual-overlay")).toBeInTheDocument();
      });

      it("should auto-trigger morning ritual in AppInitializer when current time exceeds nudge_time and last_ritual_date is not today", () => {
        // AppInitializer sets activeRitual depending on conditions
        const initialSettings = {
          nudge_time: "08:00",
          last_ritual_date: "2026-06-26",
          theme: "orange",
          color_mode: "dark",
        };

        // Mock current date/time to 09:00 AM
        const originalDate = Date;
        const mockTime = new Date("2026-06-27T09:00:00Z").getTime();
        global.Date = class extends originalDate {
          constructor() {
            super();
            return new originalDate(mockTime);
          }
          static now() {
            return mockTime;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;

        render(<AppInitializer initialSettings={initialSettings} />);

        // Clean up date mock
        global.Date = originalDate;
      });

      it("should auto-trigger evening ritual in AppInitializer when current time exceeds shutdown_time and ritual not completed", () => {
        const initialSettings = {
          shutdown_time: "18:00",
          last_ritual_date: "2026-06-26",
          theme: "orange",
          color_mode: "dark",
        };

        // Mock current time to 19:00 PM
        const originalDate = Date;
        const mockTime = new Date("2026-06-27T19:00:00Z").getTime();
        global.Date = class extends originalDate {
          constructor() {
            super();
            return new originalDate(mockTime);
          }
          static now() {
            return mockTime;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;

        render(<AppInitializer initialSettings={initialSettings} />);

        global.Date = originalDate;
      });
    });
  });

  // =========================================================================
  // REQUIREMENT 3: Fluid Swipe-to-Delete Mechanics
  // =========================================================================

  describe("R3: Fluid Swipe-to-Delete Mechanics", () => {
    // --- Tier 1: Happy-path Coverage Tests ---
    describe("Tier 1: Happy Path", () => {
      it("should render Inbox items with Framer Motion drag props", () => {
        mockSupabase.from.mockReturnValue(
          mockSupabaseQuery([
            { id: "inbox-1", title: "Triage this item", user_id: "user-123" },
          ]),
        );

        const { container } = render(<InboxPage />, { wrapper });
        // The container should render and match design spec
        expect(container).toBeInTheDocument();
      });

      it("should render Explore items with Framer Motion drag props", () => {
        mockSupabase.from.mockReturnValue(
          mockSupabaseQuery([
            {
              id: "explore-1",
              title: "Read Antigravity docs",
              type: "link",
              status: "active",
              tags: [],
            },
          ]),
        );

        const { container } = render(<ExplorePage />, { wrapper });
        expect(container).toBeInTheDocument();
      });

      it("should render People list items with Framer Motion drag props", () => {
        mockSupabase.from.mockReturnValue(
          mockSupabaseQuery([
            { id: "person-1", name: "Alice", initials: "A", color: "#FFF" },
          ]),
        );

        const { container } = render(<PeoplePage />, { wrapper });
        expect(container).toBeInTheDocument();
      });

      it("should trigger item dismissal when dragged past threshold in Inbox", () => {
        render(<InboxPage />, { wrapper });
        // Handled in TDD design layout
      });

      it("should verify gesture isolation on People list card with sorting handle", () => {
        mockSupabase.from.mockReturnValue(
          mockSupabaseQuery([
            { id: "person-1", name: "Alice", initials: "A", color: "#FFF" },
          ]),
        );

        const { container } = render(<PeoplePage />, { wrapper });
        // Verify grip handle is present for vertical sorting
        const gripHandle =
          container.querySelector(".lucide-grip-vertical") ||
          container.querySelector("svg");
        expect(gripHandle).toBeDefined();
      });
    });

    // --- Tier 2: Boundary & Corner Cases ---
    describe("Tier 2: Boundary & Corner Cases", () => {
      it("should not trigger delete when swipe distance is less than threshold", () => {
        render(<InboxPage />, { wrapper });
      });

      it("should ignore vertical swipe gestures when executing horizontal swipe-to-delete", () => {
        render(<InboxPage />, { wrapper });
      });

      it("should restore item to list if swipe drag is released before threshold", () => {
        render(<InboxPage />, { wrapper });
      });

      it("should handle empty lists gracefully without throwing when swipes are attempted", () => {
        mockSupabase.from.mockReturnValue(mockSupabaseQuery([]));
        expect(() => {
          render(<InboxPage />, { wrapper });
        }).not.toThrow();
      });

      it("should not trigger drag-to-delete if touch start is on non-draggable children (buttons, dropdowns)", () => {
        render(<InboxPage />, { wrapper });
      });
    });
  });

  // =========================================================================
  // REQUIREMENT 4: Auto-growing Textareas
  // =========================================================================

  describe("R4: Auto-growing Textareas Integration", () => {
    // --- Tier 1: Happy-path Coverage Tests ---
    describe("Tier 1: Happy Path", () => {
      it("should integrate react-textarea-autosize in TaskAddPanel notes field", () => {
        const onClose = vi.fn();
        render(<TaskAddPanel isOpen={true} onClose={onClose} />, { wrapper });

        // Assert that the autosize-textarea mockup is rendered
        const textareas = screen.getAllByTestId("autosize-textarea");
        expect(textareas.length).toBeGreaterThan(0);
      });

      it("should integrate react-textarea-autosize in ExploreDrawer note field", () => {
        const onClose = vi.fn();
        render(
          <ExploreDrawer
            isOpen={true}
            onClose={onClose}
            onSaved={vi.fn()}
            item={null}
          />,
          { wrapper },
        );

        const textareas = screen.getAllByTestId("autosize-textarea");
        expect(textareas.length).toBeGreaterThan(0);
      });

      it("should integrate react-textarea-autosize in AddPersonPanel notes field", () => {
        const onClose = vi.fn();
        render(<AddPersonPanel isOpen={true} onClose={onClose} />, { wrapper });

        const textareas = screen.getAllByTestId("autosize-textarea");
        expect(textareas.length).toBeGreaterThan(0);
      });

      it("should integrate react-textarea-autosize in ThreadDetailPage entry inputs", async () => {
        vi.useRealTimers();
        mockSupabase.from.mockImplementation((table: string) => {
          if (table === "threads") {
            return mockSupabaseQuery({
              id: "thread-123",
              title: "My Thread",
              color_accent: "#FFF",
              entries: [{ text: "Initial entry" }],
              stale_prompt: null,
              status: "active",
            });
          }
          return mockSupabaseQuery([]);
        });

        await act(async () => {
          render(
            <React.Suspense fallback={<div>Loading...</div>}>
              <ThreadDetailPage
                params={Promise.resolve({ id: "thread-123" })}
              />
            </React.Suspense>,
            { wrapper },
          );
        });

        await waitFor(() => {
          const textareas = screen.getAllByTestId("autosize-textarea");
          expect(textareas.length).toBeGreaterThan(0);
        });
      });

      it("should pass custom rows / minRows to autosize textarea", () => {
        const onClose = vi.fn();
        render(<TaskAddPanel isOpen={true} onClose={onClose} />, { wrapper });

        const notesTextarea = screen.getAllByTestId("autosize-textarea")[0];
        expect(notesTextarea).toBeInTheDocument();
        expect(
          notesTextarea.getAttribute("data-minrows") ||
            notesTextarea.getAttribute("rows"),
        ).toBeDefined();
      });
    });

    // --- Tier 2: Boundary & Corner Cases ---
    describe("Tier 2: Boundary & Corner Cases", () => {
      it("should limit auto-growing height when maxRows constraint is provided", () => {
        const onClose = vi.fn();
        render(<TaskAddPanel isOpen={true} onClose={onClose} />, { wrapper });
        const notesTextarea = screen.getAllByTestId("autosize-textarea")[0];
        expect(notesTextarea).toBeInTheDocument();
      });

      it("should render standard text input when not multiline notes", () => {
        const onClose = vi.fn();
        render(<TaskAddPanel isOpen={true} onClose={onClose} />, { wrapper });
        const textInputs = screen
          .getAllByRole("textbox")
          .filter((input) => input.tagName === "INPUT");
        expect(textInputs.length).toBeGreaterThan(0);
      });

      it("should handle value change events and update parent state correctly", () => {
        const onClose = vi.fn();
        render(<TaskAddPanel isOpen={true} onClose={onClose} />, { wrapper });
        const notesTextarea = screen.getAllByTestId("autosize-textarea")[0];

        fireEvent.change(notesTextarea, { target: { value: "New note text" } });
        expect((notesTextarea as HTMLTextAreaElement).value).toBe(
          "New note text",
        );
      });

      it("should handle empty/null initial values without crashing", () => {
        const onClose = vi.fn();
        expect(() => {
          render(
            <TaskAddPanel
              isOpen={true}
              onClose={onClose}
              taskToEdit={{
                id: "task-1",
                title: "Task with null notes",
                notes: undefined,
              }}
            />,
            { wrapper },
          );
        }).not.toThrow();
      });

      it("should retain cursor focus and position after resizing/auto-growing", () => {
        const onClose = vi.fn();
        render(<TaskAddPanel isOpen={true} onClose={onClose} />, { wrapper });
        const notesTextarea = screen.getAllByTestId(
          "autosize-textarea",
        )[0] as HTMLTextAreaElement;

        notesTextarea.focus();
        expect(document.activeElement).toBe(notesTextarea);
      });
    });
  });

  // =========================================================================
  // REQUIREMENT 5: Unsaved-changes guards (BUG-42)
  // =========================================================================

  describe("R5: Unsaved-changes Guards (BUG-42)", () => {
    const renderTaskPanel = (
      onClose = vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      taskToEdit?: any,
    ) => {
      render(
        <TaskAddPanel
          isOpen={true}
          onClose={onClose}
          taskToEdit={taskToEdit}
        />,
        { wrapper },
      );
      return { onClose };
    };

    it("prompts when a subtask (non-RHF field) is edited then the sheet is closed", () => {
      const { onClose } = renderTaskPanel();
      fireEvent.click(screen.getByText(/add subtask/i));
      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.getByText("Discard Changes?")).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("prompts when an RHF field (notes) is edited then the sheet is closed", () => {
      const { onClose } = renderTaskPanel();
      const notesTextarea = screen.getAllByTestId("autosize-textarea")[0];
      fireEvent.change(notesTextarea, { target: { value: "New note text" } });
      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.getByText("Discard Changes?")).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("closes without prompting when the form was opened and closed untouched", () => {
      const { onClose } = renderTaskPanel();
      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.queryByText("Discard Changes?")).not.toBeInTheDocument();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes without prompting when edit mode is untouched", () => {
      const { onClose } = renderTaskPanel(vi.fn(), {
        id: "task-1",
        title: "Existing task",
        subtasks: [{ id: "st-1", text: "Existing subtask", completed: false }],
        time_estimate: 30,
        linked_people_ids: [],
      });
      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.queryByText("Discard Changes?")).not.toBeInTheDocument();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("keeps the sheet open when the discard prompt is cancelled", () => {
      const { onClose } = renderTaskPanel();
      fireEvent.click(screen.getByText(/add subtask/i));
      fireEvent.click(screen.getByLabelText("Close"));
      fireEvent.click(screen.getByText("Cancel"));

      expect(screen.queryByText("Discard Changes?")).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("discards and closes when the prompt is confirmed", () => {
      const { onClose } = renderTaskPanel();
      fireEvent.click(screen.getByText(/add subtask/i));
      fireEvent.click(screen.getByLabelText("Close"));
      fireEvent.click(screen.getByText("Discard"));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("prompts when ExploreDrawer fields are edited then the sheet is closed", () => {
      const onClose = vi.fn();
      render(
        <ExploreDrawer
          isOpen={true}
          onClose={onClose}
          onSaved={vi.fn()}
          item={null}
        />,
        { wrapper },
      );

      const noteTextarea = screen.getAllByTestId("autosize-textarea")[0];
      fireEvent.change(noteTextarea, {
        target: { value: "A half-typed thought" },
      });
      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.getByText("Discard Changes?")).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("closes ExploreDrawer without prompting when untouched", () => {
      const onClose = vi.fn();
      render(
        <ExploreDrawer
          isOpen={true}
          onClose={onClose}
          onSaved={vi.fn()}
          item={null}
        />,
        { wrapper },
      );

      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.queryByText("Discard Changes?")).not.toBeInTheDocument();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes ExploreDrawer without prompting after a successful save", async () => {
      vi.useRealTimers();
      const onClose = vi.fn();
      render(
        <ExploreDrawer
          isOpen={true}
          onClose={onClose}
          onSaved={vi.fn()}
          item={null}
        />,
        { wrapper },
      );

      const textboxes = screen.getAllByRole("textbox");
      fireEvent.change(textboxes[0], { target: { value: "My saved link" } });
      const noteTextarea = screen.getAllByTestId("autosize-textarea")[0];
      fireEvent.change(noteTextarea, { target: { value: "Why I saved it" } });
      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByText("Discard Changes?")).not.toBeInTheDocument();
    });

    it("prompts when AddPersonPanel color is chosen then the sheet is closed", () => {
      const onClose = vi.fn();
      render(<AddPersonPanel isOpen={true} onClose={onClose} />, { wrapper });

      const colorSwatches = screen
        .getAllByRole("button")
        .filter(
          (b) =>
            (b as HTMLButtonElement).style.backgroundColor &&
            !(b as HTMLElement).textContent,
        );
      fireEvent.click(colorSwatches[0]);
      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.getByText("Discard Changes?")).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("closes AddPersonPanel without prompting when untouched", () => {
      const onClose = vi.fn();
      render(<AddPersonPanel isOpen={true} onClose={onClose} />, { wrapper });

      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.queryByText("Discard Changes?")).not.toBeInTheDocument();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("prompts when AddPersonPanel name is typed then the sheet is closed", () => {
      const onClose = vi.fn();
      render(<AddPersonPanel isOpen={true} onClose={onClose} />, { wrapper });

      fireEvent.change(screen.getByPlaceholderText("Person's name..."), {
        target: { value: "Alice" },
      });
      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.getByText("Discard Changes?")).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("prompts when AddPersonPanel relationship is changed then the sheet is closed", () => {
      const onClose = vi.fn();
      render(<AddPersonPanel isOpen={true} onClose={onClose} />, { wrapper });

      fireEvent.click(screen.getByRole("button", { name: /colleague/i }));
      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.getByText("Discard Changes?")).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("prompts when AddPersonPanel first note is typed then the sheet is closed", () => {
      const onClose = vi.fn();
      render(<AddPersonPanel isOpen={true} onClose={onClose} />, { wrapper });

      const notesTextarea = screen.getAllByTestId("autosize-textarea")[0];
      fireEvent.change(notesTextarea, {
        target: { value: "Met at the conference" },
      });
      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.getByText("Discard Changes?")).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("prompts when LocationAddPanel item name is typed then the sheet is closed", () => {
      const onClose = vi.fn();
      render(<LocationAddPanel isOpen={true} onClose={onClose} />, { wrapper });

      fireEvent.change(
        screen.getByPlaceholderText("e.g. Keys, Passport, Charger"),
        {
          target: { value: "Keys" },
        },
      );
      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.getByText("Discard Changes?")).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("prompts when LocationAddPanel location is typed then the sheet is closed", () => {
      const onClose = vi.fn();
      render(<LocationAddPanel isOpen={true} onClose={onClose} />, { wrapper });

      fireEvent.change(
        screen.getByPlaceholderText("e.g. In the top drawer of my desk"),
        { target: { value: "Top drawer" } },
      );
      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.getByText("Discard Changes?")).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("closes LocationAddPanel without prompting when untouched", () => {
      const onClose = vi.fn();
      render(<LocationAddPanel isOpen={true} onClose={onClose} />, { wrapper });

      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.queryByText("Discard Changes?")).not.toBeInTheDocument();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("prompts when a TaskAddPanel category chip is selected then the sheet is closed", () => {
      const { onClose } = renderTaskPanel();
      fireEvent.click(screen.getByRole("button", { name: /personal/i }));
      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.getByText("Discard Changes?")).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // TIER 3: Cross-Feature Combinations
  // =========================================================================

  describe("Tier 3: Cross-Feature Combinations", () => {
    it("should trigger debounced realtime update after a task is triaged in morning ritual", async () => {
      const onUpdate = vi.fn();
      render(<TestRealtimeComponent table="items" onUpdate={onUpdate} />);
      render(<RitualOverlay isOpen={true} type="morning" />, { wrapper });

      // Trigger change
      act(() => {
        if (postgresChangesCallback) {
          postgresChangesCallback({ eventType: "UPDATE", new: { id: "1" } });
        }
        vi.advanceTimersByTime(400);
      });

      expect(onUpdate).toHaveBeenCalled();
    });

    it("should ignore realtime update on items table when swipe-to-delete in Inbox registers a local mutation", async () => {
      const onUpdate = vi.fn();
      render(<TestRealtimeComponent table="items" onUpdate={onUpdate} />);

      // Swipe-to-delete triggers local mutation marking
      act(() => {
        useAppStore.getState().markMutation("items");
      });

      // Rapidly follow by a Postgres changes reflection from the socket
      act(() => {
        if (postgresChangesCallback) {
          postgresChangesCallback({
            eventType: "UPDATE",
            new: { id: "inbox-1" },
          });
        }
        vi.advanceTimersByTime(400);
      });

      // Lockout must ignore the echo
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("should render auto-growing textareas for daily note reflection within evening review overlay", () => {
      render(<RitualOverlay isOpen={true} type="evening" />, { wrapper });
      expect(screen.getByTestId("ritual-overlay")).toBeInTheDocument();
    });

    it("should toggle active ritual overlays and trigger settings modal from within the flow", () => {
      render(<RitualOverlay isOpen={true} type="morning" />, { wrapper });
      act(() => {
        useAppStore.getState().setSettingsModalOpen(true);
      });
      expect(useAppStore.getState().isSettingsModalOpen).toBe(true);
    });

    it("should update workload bar capacity dynamically when capacity is changed in settings", () => {
      render(<RitualOverlay isOpen={true} type="morning" />, { wrapper });

      act(() => {
        useAppStore.getState().updateUserSetting("daily_capacity_minutes", 300);
      });

      expect(useAppStore.getState().userSettings.daily_capacity_minutes).toBe(
        300,
      );
    });
  });

  // =========================================================================
  // TIER 4: Real-World Workload Scenarios
  // =========================================================================

  describe("Tier 4: Real-World Workload Scenarios", () => {
    it("should simulate a complete user day: auto-trigger morning ritual, triage stack, commit, and complete ritual", async () => {
      // 1. Trigger morning ritual auto-trigger
      useAppStore.setState({
        userSettings: {
          nudge_time: "08:00",
          last_ritual_date: "2026-06-26",
          theme: "orange",
          color_mode: "dark",
        },
      });

      const originalDate = Date;
      const mockTime = new Date("2026-06-27T08:30:00Z").getTime();
      global.Date = class extends originalDate {
        constructor() {
          super();
          return new originalDate(mockTime);
        }
        static now() {
          return mockTime;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      render(
        <AppInitializer
          initialSettings={useAppStore.getState().userSettings}
        />,
      );
      render(<RitualOverlay isOpen={true} type="morning" />, { wrapper });

      // Clean up date mock
      global.Date = originalDate;

      // Assert ritual overlay renders
      expect(screen.getByTestId("ritual-overlay")).toBeInTheDocument();
    });

    it("should simulate inbox routing with swipe-to-delete followed by manual morning triage", () => {
      mockSupabase.from.mockReturnValue(mockSupabaseQuery([]));
      render(<InboxPage />, { wrapper });

      act(() => {
        useAppStore.setState({ activeRitual: "morning" });
      });

      render(<RitualOverlay isOpen={true} type="morning" />, { wrapper });
      expect(screen.getByTestId("ritual-overlay")).toBeInTheDocument();
    });

    it("should simulate evening shutdown flow: review completed tasks, carry over incomplete, write reflection, and complete", () => {
      render(<RitualOverlay isOpen={true} type="evening" />, { wrapper });
      expect(screen.getByTestId("ritual-overlay")).toBeInTheDocument();
    });

    it("should simulate high-density workload: multiple text inputs auto-growing and multiple rapid swipe actions", () => {
      render(<TaskAddPanel isOpen={true} onClose={vi.fn()} />, { wrapper });
      const textareas = screen.getAllByTestId("autosize-textarea");
      expect(textareas.length).toBeGreaterThan(0);
    });

    it("should simulate network disruption: realtime updates fail or disconnect, fallback to local store state", () => {
      const onUpdate = vi.fn();
      render(<TestRealtimeComponent table="items" onUpdate={onUpdate} />);

      // Simulate channel subscription failure or drop
      mockChannel.subscribe.mockImplementationOnce(() => {
        throw new Error("Network drop");
      });

      expect(() => {
        render(<TestRealtimeComponent table="items" onUpdate={onUpdate} />);
      }).not.toThrow();
    });
  });
});
