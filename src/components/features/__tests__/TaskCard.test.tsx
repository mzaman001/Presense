import React from "react";
import { describe, it, expect, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, TEST_USER, makeTask } from "@/lib/__tests__/test-utils";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { TaskCard } from "@/components/features/TaskCard";

// Mock Supabase client — TaskCard reaches for it on mount (via createClient())
// even though these tests never trigger a network call.
vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
  })),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SessionProvider user={TEST_USER}>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </SessionProvider>
);

describe("TaskCard", () => {
  it("never applies a boxShadow (glow) on the priority indicator", () => {
    const task = makeTask({
      id: "task-1",
      title: "Test task",
      priority: 1,
      status: "active",
    });

    const { container } = render(
      <TaskCard
        task={task}
        completing={null}
        completeTask={vi.fn()}
        openEditPanel={vi.fn()}
        fetchTasks={vi.fn()}
      />,
      { wrapper },
    );

    const dot = container.querySelector(
      '[style*="background"][class*="rounded-full"]',
    );
    expect(dot).toBeTruthy();
    expect(dot?.getAttribute("style")).not.toMatch(/box-shadow/i);
  });

  it("uses the --priority-urgent token (not a hardcoded hex) for priority 1", () => {
    const task = makeTask({
      id: "task-2",
      title: "Urgent task",
      priority: 1,
      status: "active",
    });

    const { container } = render(
      <TaskCard
        task={task}
        completing={null}
        completeTask={vi.fn()}
        openEditPanel={vi.fn()}
        fetchTasks={vi.fn()}
      />,
      { wrapper },
    );

    // Priority is carried by the checkbox ring (Todoist-style).
    const check = container.querySelector(".task-check");
    expect(check?.getAttribute("style")).toMatch(
      /--check-ring:\s*var\(--priority-urgent\)/,
    );
  });

  it("never applies a blur filter on the card's enter/exit transition", () => {
    const task = makeTask({
      id: "task-3",
      title: "Test task",
      priority: 1,
      status: "active",
    });

    const { container } = render(
      <TaskCard
        task={task}
        completing={null}
        completeTask={vi.fn()}
        openEditPanel={vi.fn()}
        fetchTasks={vi.fn()}
      />,
      { wrapper },
    );

    const wrapperEl = container.querySelector(".task-card-wrapper");
    expect(wrapperEl).toBeTruthy();
    expect(wrapperEl?.getAttribute("style")).not.toMatch(/blur\(/i);
  });
  // A red "Overdue" on every late task feeds the guilt that drives
  // avoidance; past dates read as where the task came from.
  it("shows a past date neutrally, not as overdue", () => {
    const task = makeTask({
      id: "task-late",
      title: "Late task",
      status: "active",
      deadline: "2020-09-01T09:00:00Z",
    });
    const { container, getByText, queryByText } = render(
      <TaskCard
        task={task}
        completing={null}
        completeTask={vi.fn()}
        openEditPanel={vi.fn()}
        fetchTasks={vi.fn()}
      />,
      { wrapper },
    );
    expect(getByText(/^From Sep 1$/)).toBeInTheDocument();
    expect(queryByText(/Overdue/)).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain("--status-overdue");
  });
});
