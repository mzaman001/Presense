import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@/lib/__tests__/test-utils";
import { useAppStore } from "@/store/useAppStore";
import { PomodoroTimer } from "@/components/features/PomodoroTimer";
import { loadFocusTimer } from "@/lib/focus-timer";

// PomodoroTimer reaches for Supabase to log sessions and save a first step;
// safeMutate is mocked, so nothing is sent.
const safeMutate = vi.hoisted(() => vi.fn(async () => ({ success: true })));
vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
  safeMutate,
}));
vi.mock("@/lib/chime", () => ({ playChime: vi.fn() }));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderTimer() {
  return render(
    <QueryClientProvider client={queryClient}>
      <PomodoroTimer />
    </QueryClientProvider>,
  );
}

/** Opens the timer and starts a session of the given length. */
function startSession(minutes = 25) {
  const view = renderTimer();
  fireEvent.click(screen.getByRole("radio", { name: `${minutes} min` }));
  fireEvent.click(screen.getByRole("button", { name: /^Start/ }));
  return view;
}

/**
 * Reads the numeric z-index Tailwind's `z-[N]` (or `z-N`) arbitrary-value
 * class encodes, so the assertion below fails loudly — instead of silently
 * — if either layer's stacking value ever changes.
 */
function zIndexFromClassName(className: string): number {
  const match = className.match(/\bz-\[(\d+)\]/);
  if (match) return Number(match[1]);
  const bare = className.match(/\bz-(\d+)\b/);
  if (bare) return Number(bare[1]);
  throw new Error(`No z-index utility class found in "${className}"`);
}

describe("PomodoroTimer", () => {
  beforeEach(() => {
    localStorage.removeItem("pomodoro_state");
    safeMutate.mockClear();
    useAppStore.setState({
      activeTimer: { taskId: "task-1", taskTitle: "Write report" },
      userSettings: { pomodoro_duration: 25 },
    });
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState({ activeTimer: null });
    localStorage.removeItem("pomodoro_state");
    vi.useRealTimers();
  });

  describe("starting", () => {
    it("opens ready, without counting, until Start is pressed", () => {
      vi.useFakeTimers();
      renderTimer();

      expect(screen.getByText("Ready when you are")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Pause" }),
      ).not.toBeInTheDocument();
      act(() => vi.advanceTimersByTime(350));
      expect(screen.getByRole("button", { name: /^Start/ })).toHaveFocus();
      expect(loadFocusTimer()).toBeNull();
    });

    it("offers short starts alongside the user's own session length", () => {
      renderTimer();
      const lengths = within(
        screen.getByRole("radiogroup", { name: "Session length" }),
      )
        .getAllByRole("radio")
        .map((r) => r.textContent);
      expect(lengths).toEqual(["2 min", "5 min", "10 min", "25 min"]);
      expect(screen.getByRole("radio", { name: "25 min" })).toBeChecked();
    });

    it("shows the task's first step", () => {
      useAppStore.setState({
        activeTimer: {
          taskId: "task-1",
          taskTitle: "Write report",
          firstStep: "Open the doc and write the heading",
        },
      });
      renderTimer();
      expect(
        screen.getByText("Open the doc and write the heading"),
      ).toBeInTheDocument();
    });

    it("saves a first step typed before starting", () => {
      renderTimer();
      fireEvent.change(
        screen.getByRole("textbox", { name: /Smallest first step/ }),
        { target: { value: "Open the doc" } },
      );
      fireEvent.click(screen.getByRole("button", { name: /^Start/ }));

      expect(useAppStore.getState().activeTimer?.firstStep).toBe(
        "Open the doc",
      );
      expect(safeMutate).toHaveBeenCalled();
      expect(screen.getByText("Open the doc")).toBeInTheDocument();
    });

    it("closes straight away from ready, with nothing to confirm", () => {
      renderTimer();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(useAppStore.getState().activeTimer).toBeNull();
    });
  });

  describe("a short start", () => {
    it("ends on a choice to keep going or stop, not a break", () => {
      vi.useFakeTimers();
      startSession(2);
      expect(screen.getByText("Short start")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(2 * 60 * 1000 + 500));

      expect(screen.getByText("Nice start.")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Mark task done" }),
      ).toBeInTheDocument();
      // The 2 minutes are logged against the task.
      expect(safeMutate).toHaveBeenCalled();

      fireEvent.click(
        screen.getByRole("button", { name: "Keep going · 25 min" }),
      );
      expect(screen.getByText("Work Session")).toBeInTheDocument();
      expect(screen.getByText("25:00")).toBeInTheDocument();
    });

    it("'Done for now' closes the timer", () => {
      vi.useFakeTimers();
      startSession(2);
      act(() => vi.advanceTimersByTime(2 * 60 * 1000 + 500));
      fireEvent.click(screen.getByRole("button", { name: "Done for now" }));
      expect(useAppStore.getState().activeTimer).toBeNull();
    });
  });

  describe("pause", () => {
    it("stays paused across a reload instead of counting on", () => {
      vi.useFakeTimers();
      const view = startSession(25);
      act(() => vi.advanceTimersByTime(60 * 1000));
      fireEvent.click(screen.getByRole("button", { name: "Pause" }));
      expect(loadFocusTimer()?.pausedRemaining).toBe(24 * 60);

      view.unmount();
      act(() => vi.advanceTimersByTime(10 * 60 * 1000));
      renderTimer();

      expect(screen.getByText("24:00")).toBeInTheDocument();
      expect(screen.getByText("Paused")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    });
  });

  describe("minimise", () => {
    it("shrinks to a pill that keeps counting and can pause, then expands", () => {
      vi.useFakeTimers();
      startSession(25);
      fireEvent.click(screen.getByRole("button", { name: "Minimise timer" }));

      expect(
        screen.queryByRole("dialog", { name: "Focus session" }),
      ).not.toBeInTheDocument();
      const pill = screen.getByRole("region", { name: "Focus timer" });
      act(() => vi.advanceTimersByTime(5000));
      expect(within(pill).getByText("24:55")).toBeInTheDocument();

      fireEvent.click(within(pill).getByRole("button", { name: "Pause" }));
      expect(loadFocusTimer()).toMatchObject({
        minimized: true,
        pausedRemaining: 24 * 60 + 55,
      });

      fireEvent.click(
        within(pill).getByRole("button", {
          name: "Open focus timer: Write report",
        }),
      );
      expect(
        screen.getByRole("dialog", { name: "Focus session" }),
      ).toBeInTheDocument();
    });

    it("comes back to full size when the time is up", () => {
      vi.useFakeTimers();
      startSession(2);
      fireEvent.click(screen.getByRole("button", { name: "Minimise timer" }));
      act(() => vi.advanceTimersByTime(2 * 60 * 1000 + 500));
      expect(screen.getByText("Nice start.")).toBeInTheDocument();
    });
  });

  describe("close/end flow", () => {
    it("focuses the primary control and wraps Tab in both directions", () => {
      vi.useFakeTimers();
      startSession();

      const timer = screen.getByRole("dialog", { name: "Focus session" });
      expect(timer).toHaveAttribute("aria-modal", "true");
      act(() => vi.advanceTimersByTime(350));
      expect(
        within(timer).getByRole("button", { name: "Pause" }),
      ).toHaveFocus();

      const first = within(timer).getByRole("button", {
        name: "Close focus session",
      });
      const last = within(timer).getByRole("button", { name: "Skip phase" });
      last.focus();
      fireEvent.keyDown(last, { key: "Tab" });
      expect(first).toHaveFocus();
      fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
      expect(last).toHaveFocus();
    });

    it.each([0, 350])(
      "leaves confirmation focus to Radix when opened after %i ms and resumes after Escape",
      (delay) => {
        vi.useFakeTimers();
        startSession();
        act(() => vi.advanceTimersByTime(delay));
        const primary = screen.getByRole("button", { name: "Pause" });
        const primaryFocus = vi.spyOn(primary, "focus");
        fireEvent.keyDown(document.activeElement!, { key: "Escape" });

        const confirm = screen.getByRole("dialog", {
          name: "End focus session?",
        });
        const cancel = within(confirm).getByRole("button", { name: "Cancel" });
        const close = within(confirm).getByRole("button", { name: "Close" });
        act(() => vi.advanceTimersByTime(400));
        expect(confirm).toContainElement(document.activeElement as HTMLElement);
        expect(primaryFocus).not.toHaveBeenCalled();
        close.focus();
        fireEvent.keyDown(close, { key: "Tab" });
        expect(cancel).toHaveFocus();
        fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
        expect(close).toHaveFocus();

        fireEvent.keyDown(close, { key: "Escape" });
        act(() => vi.advanceTimersByTime(400));
        expect(
          screen.queryByRole("dialog", { name: "End focus session?" }),
        ).not.toBeInTheDocument();
        expect(useAppStore.getState().activeTimer).not.toBeNull();
        expect(primary).toHaveFocus();
      },
    );

    it("renders the confirm-end dialog above the timer overlay (regression: z-index collision)", () => {
      const { container } = startSession();

      fireEvent.click(screen.getByRole("button", { name: "End session" }));

      const overlay = container.querySelector(
        '[class*="z-\\[200\\]"]',
      ) as HTMLElement | null;
      expect(overlay).not.toBeNull();
      expect(screen.getByText("End focus session?")).toBeInTheDocument();
      const dialogContent = document.querySelector(
        '[data-slot="dialog-content"]',
      ) as HTMLElement | null;
      expect(dialogContent).not.toBeNull();
      // Confirm must out-rank the backdrop, or it renders unclickable under
      // it (the original bug: the only way out was a page refresh).
      expect(zIndexFromClassName(dialogContent!.className)).toBeGreaterThan(
        zIndexFromClassName(overlay!.className),
      );
    });

    it("pressing Escape during a session opens the confirm instead of closing", () => {
      startSession();
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.getByText("End focus session?")).toBeInTheDocument();
      expect(useAppStore.getState().activeTimer).not.toBeNull();
    });

    it("confirming End Session clears the timer and its saved state", async () => {
      startSession();
      fireEvent.click(screen.getByRole("button", { name: "End session" }));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "End Session" }));
      });
      expect(useAppStore.getState().activeTimer).toBeNull();
      expect(loadFocusTimer()).toBeNull();
    });
  });
});
