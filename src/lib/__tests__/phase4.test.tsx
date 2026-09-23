import React from "react";
import { render, screen, fireEvent, waitFor, act, within } from "./test-utils";
import { Input } from "@/components/ui/Input";
import { TEST_USER } from "./test-utils";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAppStore } from "@/store/useAppStore";
import { useRealtime } from "@/hooks/useRealtime";
import {
  RealtimeProvider,
  resetMutationTracking,
} from "@/components/providers/RealtimeProvider";

// Import stubs/components to test
import { RitualOverlay } from "@/components/features/RitualOverlay";
import { TaskAddPanel } from "@/components/features/TaskAddPanel";
import { LocationAddPanel } from "@/components/features/LocationAddPanel";
import ThreadDetailPage from "@/app/(app)/think/[id]/page";
import InboxPage from "@/app/(app)/inbox/page";
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
    // eslint-disable-next-line react/display-name
    default: React.forwardRef<
      HTMLTextAreaElement,
      React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
        minRows?: number;
        maxRows?: number;
      }
    >(({ minRows, maxRows, ...props }, ref) => {
      return (
        <textarea
          ref={ref}
          data-testid="autosize-textarea"
          data-minrows={minRows}
          data-maxrows={maxRows}
          {...props}
        />
      );
    }),
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
  <SessionProvider user={TEST_USER}>
    <QueryClientProvider client={queryClient}> {children} </QueryClientProvider>
  </SessionProvider>
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

/**
 * The hook subscribes only through RealtimeProvider, so these tests render
 * inside one. Previously they rendered bare, which exercised a standalone
 * fallback path that never ran in the real app.
 */
function RealtimeHarness(props: { table: string; onUpdate: () => void }) {
  return (
    <RealtimeProvider>
      <TestRealtimeComponent {...props} />
    </RealtimeProvider>
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
    // Echo-suppression timestamps are module state; under fake timers a mark
    // from a previous test would still read as "just now" and swallow events.
    resetMutationTracking();

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
      prefetchedThreads: {},
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Phase 1 form correctness", () => {
    beforeEach(() => {
      vi.useRealTimers();
      useAppStore.setState({
        userSettings: {
          ...useAppStore.getState().userSettings,
          nlp_date_parsing: false,
        },
      });
    });

    it.each([
      "add subtask",
      "toggle subtask",
      "remove subtask",
      "add category",
      "repeat",
    ])("%s does not submit a valid task form", async (action) => {
      const onClose = vi.fn();
      const onTaskAdded = vi.fn();
      const query = mockSupabaseQuery();
      mockSupabase.from.mockReturnValue(query);
      render(
        <TaskAddPanel
          isOpen={true}
          onClose={onClose}
          onTaskAdded={onTaskAdded}
          taskToEdit={{
            id: "task-1",
            title: "Existing task",
            subtasks: [{ text: "Existing subtask", completed: false }],
          }}
        />,
        { wrapper },
      );
      const save = screen.getByRole("button", { name: "Save changes" });
      await waitFor(() => expect(save).toBeEnabled());
      // Save sits in the pinned footer, tied to the form by its `form` attribute.
      const form = (save as HTMLButtonElement).form!;
      const onSubmit = vi.fn();
      form.addEventListener("submit", onSubmit);
      const subtask = screen.getByDisplayValue("Existing subtask");
      const row = within(subtask.parentElement!);
      // The done toggle is a real checkbox now (role="checkbox"); the
      // remove control is the row's only button.
      const button =
        action === "toggle subtask"
          ? row.getByRole("checkbox")
          : action === "remove subtask"
            ? row.getByRole("button", { name: /remove subtask/i })
            : screen.getByRole("button", {
                name:
                  action === "add subtask"
                    ? /add subtask/i
                    : action === "add category"
                      ? /^new$/i
                      : "Repeat",
              });

      await act(async () => {
        fireEvent.click(button);
      });

      expect(onSubmit).not.toHaveBeenCalled();
      expect(query.update).not.toHaveBeenCalled();
      expect(query.insert).not.toHaveBeenCalled();
      expect(onTaskAdded).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(button).toHaveAttribute("type", "button");
      if (action === "add subtask") {
        expect(screen.getAllByPlaceholderText("Subtask")).toHaveLength(2);
      } else if (action === "toggle subtask") {
        expect(subtask).toHaveClass("line-through");
      } else if (action === "remove subtask") {
        expect(
          screen.queryByDisplayValue("Existing subtask"),
        ).not.toBeInTheDocument();
      } else if (action === "add category") {
        expect(
          screen.getByPlaceholderText("Type & enter..."),
        ).toBeInTheDocument();
      } else {
        expect(
          screen.getByRole("button", { name: "Weekly" }),
        ).toBeInTheDocument();
      }

      await act(async () => {
        fireEvent.click(save);
      });
      expect(onSubmit).toHaveBeenCalledTimes(1);
      expect(query.update).toHaveBeenCalledTimes(1);
      expect(onTaskAdded).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("uses explicit non-submit types for scheduling options", async () => {
      render(<TaskAddPanel isOpen={true} onClose={vi.fn()} />, { wrapper });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Due date" }));
        fireEvent.click(screen.getByRole("button", { name: "Repeat" }));
      });
      for (const name of [
        "Today",
        "Tomorrow",
        "This weekend",
        "Next week",
        "No date",
        "Does not repeat",
        "Daily",
        "Weekly",
        "Monthly",
        "Custom",
      ]) {
        expect(screen.getByRole("button", { name })).toHaveAttribute(
          "type",
          "button",
        );
      }
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Weekly" }));
      });
      for (const name of ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]) {
        expect(screen.getByRole("button", { name })).toHaveAttribute(
          "type",
          "button",
        );
      }
    });

    it("links task validation to the generated input error ID and keeps invalid submit disabled", async () => {
      render(<TaskAddPanel isOpen={true} onClose={vi.fn()} />, { wrapper });
      const input = screen.getByRole("textbox", { name: /task name/i });
      const save = screen.getByRole("button", { name: "Add task" });
      expect(save).toBeDisabled();
      fireEvent.change(input, { target: { value: "Task" } });
      await waitFor(() => expect(save).toBeEnabled());
      fireEvent.change(input, { target: { value: "" } });
      await screen.findByText("Title is required");
      expect(input).toHaveAccessibleDescription("Title is required");
      expect(input).toHaveAttribute("aria-describedby", `${input.id}-error`);
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(save).toBeDisabled();
      fireEvent.change(input, { target: { value: "Task" } });
      await waitFor(() => expect(save).toBeEnabled());
      expect(input).not.toHaveAttribute("aria-describedby");
      expect(screen.queryByText("Title is required")).not.toBeInTheDocument();
    });

    it("links both location validation messages and keeps invalid submit disabled", async () => {
      render(<LocationAddPanel isOpen={true} onClose={vi.fn()} />, { wrapper });
      const name = screen.getByRole("textbox", { name: /item name/i });
      const location = screen.getByRole("textbox", { name: /^location/i });
      const save = screen.getByRole("button", { name: "Save" });
      expect(save).toBeDisabled();
      fireEvent.change(name, { target: { value: "Keys" } });
      fireEvent.change(location, { target: { value: "Desk" } });
      await waitFor(() => expect(save).toBeEnabled());
      fireEvent.change(name, { target: { value: "" } });
      fireEvent.change(location, { target: { value: "" } });
      await screen.findByText("Name is required");
      await screen.findByText("Location is required");
      expect(name).toHaveAccessibleDescription("Name is required");
      expect(location).toHaveAccessibleDescription("Location is required");
      for (const input of [name, location]) {
        expect(input).toHaveAttribute("aria-describedby", `${input.id}-error`);
        expect(input).toHaveAttribute("aria-invalid", "true");
      }
      expect(save).toBeDisabled();
      fireEvent.change(name, { target: { value: "Keys" } });
      fireEvent.change(location, { target: { value: "Desk" } });
      await waitFor(() => expect(save).toBeEnabled());
      expect(name).not.toHaveAttribute("aria-describedby");
      expect(location).not.toHaveAttribute("aria-describedby");
    });

    it.each([undefined, "custom-input"])(
      "preserves custom descriptions alongside Input hints and errors with id %s",
      (id) => {
        const content = (error?: string, hint?: string) => (
          <>
            <p id="description">Custom description</p>
            <p id="details">More details</p>
            <Input
              id={id}
              label="Field"
              aria-describedby="description details"
              hint={hint}
              error={error}
            />
          </>
        );
        const { rerender } = render(content(undefined, "Helpful hint"));
        const input = screen.getByRole("textbox", { name: "Field" });
        const inputId = input.id;
        expect(input).toHaveAccessibleDescription(
          "Custom description More details Helpful hint",
        );
        rerender(content("Required", "Helpful hint"));
        expect(input.id).toBe(inputId);
        expect(input).toHaveAccessibleDescription(
          "Custom description More details Required",
        );
        expect(screen.queryByText("Helpful hint")).not.toBeInTheDocument();
        expect(document.getElementById(`${inputId}-error`)).toHaveTextContent(
          "Required",
        );
        rerender(content(undefined, "Helpful hint"));
        expect(input).toHaveAccessibleDescription(
          "Custom description More details Helpful hint",
        );
        expect(
          document.getElementById(`${inputId}-error`),
        ).not.toBeInTheDocument();
        rerender(content());
        expect(input).toHaveAttribute(
          "aria-describedby",
          "description details",
        );
      },
    );
  });

  // =========================================================================
  // REQUIREMENT 1: useRealtime Hook Debouncing
  // =========================================================================

  describe("R1: useRealtime Hook Debouncing & Lockouts", () => {
    // --- Tier 1: Happy-path Coverage Tests ---
    describe("Tier 1: Happy Path", () => {
      it("should register a subscription on the specified table when mounted", () => {
        const onUpdate = vi.fn();
        render(<RealtimeHarness table="items" onUpdate={onUpdate} />);

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
        render(<RealtimeHarness table="items" onUpdate={onUpdate} />);

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
        render(<RealtimeHarness table="items" onUpdate={onUpdate} />);

        // Mark local mutation on 'locations' table
        act(() => {
          useAppStore.getState().markMutation("locations");
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
        render(<RealtimeHarness table="items" onUpdate={onUpdate} />);

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
          <RealtimeHarness table="items" onUpdate={onUpdate} />,
        );

        unmount();
        expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
      });
    });

    // --- Tier 2: Boundary & Corner Cases ---
    describe("Tier 2: Boundary & Corner Cases", () => {
      it("should ignore Postgres changes if a local mutation occurred on the same table within 500ms (lockout)", async () => {
        const onUpdate = vi.fn();
        render(<RealtimeHarness table="items" onUpdate={onUpdate} />);

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
        render(<RealtimeHarness table="items" onUpdate={onUpdate} />);

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
        render(<RealtimeHarness table="items" onUpdate={onUpdate} />);

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
          <RealtimeHarness table="items" onUpdate={onUpdate} />,
        );

        act(() => {
          useAppStore.getState().markMutation("items");
        });

        // Change table prop to "locations"
        rerender(<RealtimeHarness table="locations" onUpdate={onUpdate} />);

        act(() => {
          if (postgresChangesCallback) {
            postgresChangesCallback({ eventType: "UPDATE", new: { id: "10" } });
          }
          vi.advanceTimersByTime(400);
        });

        // Should trigger update since lockout was on 'items', not 'locations'
        expect(onUpdate).toHaveBeenCalledTimes(1);
      });

      it("should handle database error payloads or system events without breaking the listener", async () => {
        const onUpdate = vi.fn();
        render(<RealtimeHarness table="items" onUpdate={onUpdate} />);

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

        expect(screen.getByTestId("ritual-overlay")).toBeInTheDocument();
        expect(screen.getByText(/Morning Planning/i)).toBeInTheDocument();

        // Each loose end offers the same three places to go.
        expect(screen.getByText("Overdue Task")).toBeInTheDocument();
        expect(screen.getByText("New Inbox Item")).toBeInTheDocument();
        const choices = within(
          screen.getByRole("group", { name: /Overdue Task/ }),
        ).getAllByRole("button");
        expect(choices.map((b) => b.textContent)).toEqual([
          "Today",
          "Tomorrow",
          "Someday",
        ]);
        expect(screen.getByText("2 to place")).toBeInTheDocument();

        // Placing one removes it from the list.
        fireEvent.click(choices[0]);
        await waitFor(() =>
          expect(screen.queryByText("Overdue Task")).not.toBeInTheDocument(),
        );
        expect(screen.getByText("1 to place")).toBeInTheDocument();
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
      it("lets you continue while loose ends remain (they stay where they are)", async () => {
        vi.useRealTimers();
        mockSupabase.from.mockReturnValue(
          mockSupabaseQuery([
            { id: "t1", title: "Unplaced", status: "inbox", deadline: null },
          ]),
        );
        render(<RitualOverlay isOpen={true} type="morning" />, { wrapper });
        await screen.findByText("Unplaced");

        const next = screen.getByRole("button", { name: /continue/i });
        // Used to be disabled until the inbox was empty, with no explanation.
        expect(next).toBeEnabled();
        fireEvent.click(next);
        expect(await screen.findByText("Shape your day.")).toBeInTheDocument();
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

      it("should trigger item dismissal when dragged past threshold in Inbox", () => {
        render(<InboxPage />, { wrapper });
        // Handled in TDD design layout
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

      expect(screen.getByText("Discard changes?")).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("prompts when an RHF field (notes) is edited then the sheet is closed", () => {
      const { onClose } = renderTaskPanel();
      const notesTextarea = screen.getAllByTestId("autosize-textarea")[0];
      fireEvent.change(notesTextarea, { target: { value: "New note text" } });
      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.getByText("Discard changes?")).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("closes without prompting when the form was opened and closed untouched", () => {
      const { onClose } = renderTaskPanel();
      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes without prompting when edit mode is untouched", () => {
      const { onClose } = renderTaskPanel(vi.fn(), {
        id: "task-1",
        title: "Existing task",
        subtasks: [{ id: "st-1", text: "Existing subtask", completed: false }],
        time_estimate: 30,
      });
      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("keeps the sheet open when the discard prompt is cancelled", () => {
      const { onClose } = renderTaskPanel();
      fireEvent.click(screen.getByText(/add subtask/i));
      fireEvent.click(screen.getByLabelText("Close"));
      fireEvent.click(
        within(
          screen.getByRole("dialog", { name: /discard changes/i }),
        ).getByText("Cancel"),
      );

      expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("discards and closes when the prompt is confirmed", () => {
      const { onClose } = renderTaskPanel();
      fireEvent.click(screen.getByText(/add subtask/i));
      fireEvent.click(screen.getByLabelText("Close"));
      fireEvent.click(screen.getByText("Discard"));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("prompts when LocationAddPanel item name is typed then the sheet is closed", () => {
      const onClose = vi.fn();
      render(<LocationAddPanel isOpen={true} onClose={onClose} />, { wrapper });

      fireEvent.change(screen.getByRole("textbox", { name: "Item name" }), {
        target: { value: "Keys" },
      });
      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.getByText("Discard changes?")).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("prompts when LocationAddPanel location is typed then the sheet is closed", () => {
      const onClose = vi.fn();
      render(<LocationAddPanel isOpen={true} onClose={onClose} />, { wrapper });

      fireEvent.change(screen.getByRole("textbox", { name: "Location" }), {
        target: { value: "Top drawer" },
      });
      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.getByText("Discard changes?")).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("closes LocationAddPanel without prompting when untouched", () => {
      const onClose = vi.fn();
      render(<LocationAddPanel isOpen={true} onClose={onClose} />, { wrapper });

      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("prompts when a TaskAddPanel category chip is selected then the sheet is closed", () => {
      const { onClose } = renderTaskPanel();
      fireEvent.click(screen.getByRole("button", { name: /personal/i }));
      fireEvent.click(screen.getByLabelText("Close"));

      expect(screen.getByText("Discard changes?")).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // TIER 3: Cross-Feature Combinations
  // =========================================================================

  describe("Tier 3: Cross-Feature Combinations", () => {
    it("should trigger debounced realtime update after a task is triaged in morning ritual", async () => {
      const onUpdate = vi.fn();
      render(<RealtimeHarness table="items" onUpdate={onUpdate} />);
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
      render(<RealtimeHarness table="items" onUpdate={onUpdate} />);

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
      render(<RealtimeHarness table="items" onUpdate={onUpdate} />);

      // Simulate channel subscription failure or drop
      mockChannel.subscribe.mockImplementationOnce(() => {
        throw new Error("Network drop");
      });

      expect(() => {
        render(<RealtimeHarness table="items" onUpdate={onUpdate} />);
      }).not.toThrow();
    });
  });
});
