import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileCalendar } from "@/components/features/calendar/MobileCalendar";
import type { Task } from "@/types/calendar";

const WED = new Date(2026, 8, 23, 12, 0); // Wed 23 Sep 2026

const task = (id: string, title: string, deadline: Date) =>
  ({
    id,
    title,
    deadline: deadline.toISOString(),
    category: "work",
    status: "active",
  }) as unknown as Task;

const tasks = [
  task("a", "Call the bank", new Date(2026, 8, 23, 9, 30)),
  task("b", "Buy flowers", new Date(2026, 8, 25, 0, 0)), // all-day Friday
];

describe("MobileCalendar", () => {
  it("day view: week strip plus that day's agenda with times", () => {
    render(
      <MobileCalendar
        subView="day"
        currentDate={WED}
        onSelectDate={vi.fn()}
        tasks={tasks}
        onEditTask={vi.fn()}
      />,
    );
    expect(
      screen.getAllByRole("button", {
        name: /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) /,
      }),
    ).toHaveLength(7);
    expect(screen.getByText("Call the bank")).toBeInTheDocument();
    expect(screen.getByText("9:30 AM")).toBeInTheDocument();
    expect(screen.queryByText("Buy flowers")).not.toBeInTheDocument();
  });

  it("week view lists every day and marks empty ones as free", () => {
    render(
      <MobileCalendar
        subView="week"
        currentDate={WED}
        onSelectDate={vi.fn()}
        tasks={tasks}
        onEditTask={vi.fn()}
      />,
    );
    expect(screen.getByText("Call the bank")).toBeInTheDocument();
    expect(screen.getByText("Buy flowers")).toBeInTheDocument();
    expect(screen.getByText("All day")).toBeInTheDocument();
    expect(screen.getAllByText(/Free/)).toHaveLength(5);
  });

  it("month view selects a day and opens a task for editing", () => {
    const onSelectDate = vi.fn();
    const onEditTask = vi.fn();
    render(
      <MobileCalendar
        subView="month"
        currentDate={WED}
        onSelectDate={onSelectDate}
        tasks={tasks}
        onEditTask={onEditTask}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Friday 25 September, 1 task" }),
    );
    expect(onSelectDate).toHaveBeenCalledWith(new Date(2026, 8, 25));

    fireEvent.click(screen.getByText("Call the bank"));
    expect(onEditTask).toHaveBeenCalledWith(tasks[0]);
  });
});
