import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DndContext } from "@dnd-kit/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { addMonths, format } from "date-fns";
import {
  act,
  cleanup,
  fireEvent,
  makeTask,
  render,
  screen,
  waitFor,
  within,
} from "@/lib/__tests__/test-utils";
import { MonthView } from "@/components/features/calendar/MonthView";
import { CalendarTaskChip } from "@/components/features/calendar/CalendarTaskChip";
import { CalendarView } from "@/components/features/calendar/CalendarView";

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
  safeMutate: vi.fn(),
}));

const date = new Date(2026, 8, 17, 9);
const task = makeTask({
  id: "calendar-task",
  title: "Calendar regression task",
  deadline: date.toISOString(),
});
const taskName = `Edit task: ${task.title}`;
const dayName = /Calendar day Thursday, September 17, 2026/;

function renderMonth(tasks = [task]) {
  const onCreateTaskAt = vi.fn();
  const onEditTask = vi.fn();
  render(
    <DndContext>
      <MonthView
        currentMonth={date}
        tasks={tasks}
        onCreateTaskAt={onCreateTaskAt}
        onEditTask={onEditTask}
      />
    </DndContext>,
  );
  return { onCreateTaskAt, onEditTask };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MonthView interaction boundaries", () => {
  it("creates at local 9am when the day background or its noninteractive content is clicked", () => {
    const { onCreateTaskAt } = renderMonth([]);
    const day = screen.getByRole("button", { name: dayName });
    fireEvent.click(day);
    expect(onCreateTaskAt).toHaveBeenCalledExactlyOnceWith(date);
    fireEvent.click(day.querySelector(".space-y-0\\.5")!);
    expect(onCreateTaskAt).toHaveBeenCalledTimes(2);
    expect(onCreateTaskAt).toHaveBeenLastCalledWith(date);
  });

  it.each(["Enter", " "])(
    "creates once when the focused day receives %s",
    (key) => {
      const { onCreateTaskAt } = renderMonth([]);
      const day = screen.getByRole("button", { name: dayName });
      day.focus();
      fireEvent.keyDown(day, { key });
      expect(onCreateTaskAt).toHaveBeenCalledExactlyOnceWith(date);
    },
  );

  it("edits a clicked task without creating a task", () => {
    const { onCreateTaskAt, onEditTask } = renderMonth();
    fireEvent.click(screen.getByRole("button", { name: taskName }));
    expect(onEditTask).toHaveBeenCalledExactlyOnceWith(task);
    expect(onCreateTaskAt).not.toHaveBeenCalled();
  });

  it.each(["Enter", " "])(
    "does not create or cancel native activation for overflow %s",
    (key) => {
      const tasks = Array.from({ length: 4 }, (_, index) =>
        makeTask({ ...task, id: `task-${index}` }),
      );
      const { onCreateTaskAt } = renderMonth(tasks);
      const overflow = screen.getByRole("button", {
        name: "Show all 4 tasks for September 17",
      });
      overflow.focus();
      expect(fireEvent.keyDown(overflow, { key })).toBe(true);
      fireEvent.click(overflow);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(onCreateTaskAt).not.toHaveBeenCalled();
    },
  );

  it("keeps popover background and close interactions from creating tasks", () => {
    const tasks = Array.from({ length: 4 }, (_, index) =>
      makeTask({ ...task, id: `task-${index}` }),
    );
    const { onCreateTaskAt } = renderMonth(tasks);
    fireEvent.click(
      screen.getByRole("button", { name: "Show all 4 tasks for September 17" }),
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByText("Thursday, September 17"));
    const close = within(dialog).getByRole("button", {
      name: "Close day tasks",
    });
    expect(fireEvent.keyDown(close, { key: "Enter" })).toBe(true);
    fireEvent.click(close);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onCreateTaskAt).not.toHaveBeenCalled();
  });

  it.each(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"])(
    "does not move day focus on a descendant %s",
    (key) => {
      renderMonth();
      const chip = screen.getByRole("button", { name: taskName });
      chip.focus();
      expect(fireEvent.keyDown(chip, { key, code: key })).toBe(true);
      expect(chip).toHaveFocus();
    },
  );
});

describe.each(["month", "week", "allday"] as const)(
  "CalendarTaskChip %s keyboard gestures",
  (variant) => {
    it.each([
      ["Enter", "Enter"],
      [" ", "Space"],
    ])(
      "preserves native %s drag activation, movement and drop without editing",
      async (key, code) => {
        const onEdit = vi.fn();
        const onDragStart = vi.fn();
        const onDragMove = vi.fn();
        const onDragEnd = vi.fn();
        render(
          <DndContext
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
          >
            <CalendarTaskChip task={task} variant={variant} onEdit={onEdit} />
          </DndContext>,
        );
        const chip = screen.getByRole("button", { name: taskName });
        chip.focus();
        fireEvent.keyDown(chip, { key, code });
        await waitFor(() => expect(onDragStart).toHaveBeenCalledTimes(1));
        await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
        expect(chip).toHaveAttribute("aria-pressed", "true");
        fireEvent.keyDown(chip, { key: "ArrowRight", code: "ArrowRight" });
        await waitFor(() => expect(onDragMove).toHaveBeenCalled());
        expect(chip).toHaveFocus();
        fireEvent.keyDown(chip, { key: "F2", code: "F2" });
        expect(onEdit).not.toHaveBeenCalled();
        fireEvent.keyDown(chip, { key, code });
        await waitFor(() => expect(onDragEnd).toHaveBeenCalledTimes(1));
        expect(onEdit).not.toHaveBeenCalled();
      },
    );

    it("offers discoverable F2 editing separately from keyboard drag", () => {
      const onEdit = vi.fn();
      const onDragStart = vi.fn();
      render(
        <DndContext onDragStart={onDragStart}>
          <CalendarTaskChip task={task} variant={variant} onEdit={onEdit} />
        </DndContext>,
      );
      const chip = screen.getByRole("button", { name: taskName });
      expect(chip).toHaveAttribute("aria-keyshortcuts", "F2");
      expect(chip).toHaveAttribute("title", expect.stringContaining("F2"));
      chip.focus();
      fireEvent.keyDown(chip, { key: "F2", code: "F2" });
      expect(onEdit).toHaveBeenCalledExactlyOnceWith(task);
      expect(onDragStart).not.toHaveBeenCalled();
    });
  },
);

describe("CalendarView keyboard scope", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  it("keeps day navigation inside the month and root navigation on the root", () => {
    const today = new Date();
    const queryClient = new QueryClient();
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <NuqsTestingAdapter searchParams="?subview=month">
          <CalendarView tasks={[]} onEditTask={vi.fn()} />
        </NuqsTestingAdapter>
      </QueryClientProvider>,
    );
    const days = screen.getAllByRole("button", { name: /^Calendar day/ });
    days[10].focus();
    fireEvent.keyDown(days[10], { key: "ArrowRight", code: "ArrowRight" });
    expect(days[11]).toHaveFocus();
    expect(screen.getByRole("heading")).toHaveTextContent(
      format(today, "MMMM yyyy"),
    );
    const root = container.firstElementChild as HTMLElement;
    root.focus();
    fireEvent.keyDown(root, { key: "ArrowRight", code: "ArrowRight" });
    expect(screen.getByRole("heading")).toHaveTextContent(
      format(addMonths(today, 1), "MMMM yyyy"),
    );
    fireEvent.keyDown(root, { key: "t" });
    expect(screen.getByRole("heading")).toHaveTextContent(
      format(today, "MMMM yyyy"),
    );
  });

  it("leaves task arrows available to the real keyboard sensor without changing months or creating tasks", async () => {
    const today = new Date();
    const currentTask = makeTask({ ...task, deadline: today.toISOString() });
    const onCreateTaskAt = vi.fn();
    const onEditTask = vi.fn();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NuqsTestingAdapter searchParams="?subview=month">
          <CalendarView
            tasks={[currentTask]}
            onEditTask={onEditTask}
            onCreateTaskAt={onCreateTaskAt}
          />
        </NuqsTestingAdapter>
      </QueryClientProvider>,
    );
    const chip = screen.getByRole("button", { name: taskName });
    chip.focus();
    fireEvent.keyDown(chip, { key: " ", code: "Space" });
    await waitFor(() => expect(chip).toHaveAttribute("aria-pressed", "true"));
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    fireEvent.keyDown(chip, { key: "ArrowRight", code: "ArrowRight" });
    expect(chip).toHaveFocus();
    expect(screen.getByRole("heading")).toHaveTextContent(
      format(today, "MMMM yyyy"),
    );
    await waitFor(() => expect(chip.style.transform).toContain("25px"));
    fireEvent.keyDown(chip, { key: "Escape", code: "Escape" });
    await waitFor(() =>
      expect(chip).not.toHaveAttribute("aria-pressed", "true"),
    );
    expect(onCreateTaskAt).not.toHaveBeenCalled();
    expect(onEditTask).not.toHaveBeenCalled();
  });
});
