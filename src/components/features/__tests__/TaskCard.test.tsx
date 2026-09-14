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

    const dot = container.querySelector(
      '[style*="background"][class*="rounded-full"]',
    );
    expect(dot?.getAttribute("style")).toMatch(
      /background:\s*var\(--priority-urgent\)/,
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
});
