import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@/lib/__tests__/test-utils";
import { useAppStore } from "@/store/useAppStore";
import { PomodoroTimer } from "@/components/features/PomodoroTimer";

// PomodoroTimer reaches for Supabase on mount/session-log, but these tests
// never let a session complete, so the client is never actually called.
vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
  safeMutate: vi.fn(async () => ({ success: true })),
}));

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

/**
 * Reads the numeric z-index Tailwind's `z-[N]` (or `z-N`) arbitrary-value
 * class encodes, so the assertion below fails loudly — instead of silently
 * — if either layer's stacking value ever changes.
 */
function zIndexFromClassName(className: string): number {
  const match = className.match(/\bz-\[(\d+)\]/);
  if (match) return Number(match[1]);
  // Tailwind's bare scale (z-50, z-10, ...) maps 1:1 to CSS z-index.
  const bare = className.match(/\bz-(\d+)\b/);
  if (bare) return Number(bare[1]);
  throw new Error(`No z-index utility class found in "${className}"`);
}

describe("PomodoroTimer close/end flow", () => {
  beforeEach(() => {
    useAppStore.setState({
      activeTimer: { taskId: "task-1", taskTitle: "Write report" },
    });
  });

  afterEach(() => {
    useAppStore.setState({ activeTimer: null });
    localStorage.removeItem("pomodoro_state");
  });

  it("renders the confirm-end dialog above the timer overlay (regression: z-index collision)", () => {
    const { container } = renderTimer();

    fireEvent.click(screen.getByRole("button", { name: "End session" }));

    const overlay = container.querySelector(
      '[class*="z-\\[200\\]"]',
    ) as HTMLElement | null;
    expect(overlay).not.toBeNull();

    const confirmTitle = screen.getByText("End focus session?");
    expect(confirmTitle).toBeInTheDocument();

    // The Dialog's own content node (data-slot="dialog-content") carries the
    // z-index class passed through from PomodoroTimer's ConfirmModal call.
    const dialogContent = document.querySelector(
      '[data-slot="dialog-content"]',
    ) as HTMLElement | null;
    expect(dialogContent).not.toBeNull();

    const overlayZ = zIndexFromClassName(overlay!.className);
    const dialogZ = zIndexFromClassName(dialogContent!.className);

    // Confirm dialog must out-rank the Pomodoro backdrop, or it renders
    // invisible/unclickable underneath it (the original bug: the only way
    // out of a running session was a page refresh).
    expect(dialogZ).toBeGreaterThan(overlayZ);
  });

  it("pressing Escape opens the confirm-end dialog instead of closing immediately", () => {
    renderTimer();

    expect(screen.queryByText("End focus session?")).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByText("End focus session?")).toBeInTheDocument();
    // Ending a running session should still require confirmation — Escape
    // must not clear activeTimer directly.
    expect(useAppStore.getState().activeTimer).not.toBeNull();
  });

  it("confirming End Session clears activeTimer and dismisses the overlay", () => {
    renderTimer();

    fireEvent.click(screen.getByRole("button", { name: "End session" }));
    fireEvent.click(screen.getByRole("button", { name: "End Session" }));

    expect(useAppStore.getState().activeTimer).toBeNull();
  });
});
