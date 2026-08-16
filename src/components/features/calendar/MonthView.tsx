"use client";

import React, { useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
} from "date-fns";
import { CalendarTaskChip } from "./CalendarTaskChip";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

import { Task } from "@/types/calendar";
import { Icon as UiIcon } from "@/components/ui/Icon";

interface MonthViewProps {
  currentMonth: Date;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onCreateTaskAt?: (deadline: Date) => void;
}

const MAX_VISIBLE = 3;
const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function DroppableDay({
  id,
  children,
  className,
  dayIndex,
  onClick,
  style,
  ariaLabel,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
  dayIndex: number;
  onClick: () => void;
  style?: React.CSSProperties;
  ariaLabel: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevWeekIndex = dayIndex - 7;
      if (prevWeekIndex >= 0) {
        (
          document.querySelector(
            `[data-month-slot="${prevWeekIndex}"]`,
          ) as HTMLElement
        )?.focus();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextWeekIndex = dayIndex + 7;
      (
        document.querySelector(
          `[data-month-slot="${nextWeekIndex}"]`,
        ) as HTMLElement
      )?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevDay = dayIndex - 1;
      if (prevDay >= 0) {
        (
          document.querySelector(
            `[data-month-slot="${prevDay}"]`,
          ) as HTMLElement
        )?.focus();
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextDay = dayIndex + 1;
      (
        document.querySelector(`[data-month-slot="${nextDay}"]`) as HTMLElement
      )?.focus();
    }
  };

  return (
    <div
      ref={setNodeRef}
      tabIndex={0}
      role="button"
      aria-label={ariaLabel}
      data-month-slot={dayIndex}
      onKeyDown={handleKeyDown}
      className={cn(
        "transition-colors outline-none focus:bg-[rgba(255,255,255,0.08)]",
        isOver && "bg-[var(--accent-dim)]/20",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}

function DayPopover({
  date,
  tasks,
  onClose,
  onEditTask,
  isBottomRow,
}: {
  date: Date;
  tasks: Task[];
  onClose: () => void;
  onEditTask: (task: Task) => void;
  isBottomRow?: boolean;
}) {
  const popoverRef = React.useRef<HTMLDivElement>(null);

  // Close the popover when Escape is pressed from within it.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      (popoverRef.current?.previousElementSibling as HTMLElement)?.focus();
    }
  };

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={`Tasks for ${format(date, "EEEE, MMMM d")}`}
      onKeyDown={handleKeyDown}
      className={cn(
        "absolute left-0 z-50 w-64 space-y-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-2xl",
        isBottomRow ? "bottom-full mb-1" : "top-full mt-1",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--color-text-1)]">
          {format(date, "EEEE, MMMM d")}
        </span>
        <button
          onClick={onClose}
          aria-label="Close day tasks"
          className="rounded p-0.5 text-[var(--color-text-3)] hover:text-[var(--color-text-1)]"
        >
          <UiIcon size={12} icon={X} />
        </button>
      </div>
      {tasks.map((t) => (
        <CalendarTaskChip
          key={t.id}
          task={t}
          variant="month"
          onEdit={(task) => {
            onClose();
            onEditTask(task);
          }}
        />
      ))}
    </div>
  );
}

export function MonthView({
  currentMonth,
  tasks,
  onEditTask,
  onCreateTaskAt,
}: MonthViewProps) {
  const [popoverDay, setPopoverDay] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const allDays = eachDayOfInterval({ start: startDate, end: endDate });

  // PERF-16: index tasks by their deadline day once per render instead of
  // scanning the full list + parsing the deadline for every grid cell
  // (~42 cells per render, re-run on every popoverDay change).
  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.deadline) continue;
      const key = format(parseISO(t.deadline), "yyyy-MM-dd");
      const list = map.get(key);
      if (list) list.push(t);
      else map.set(key, [t]);
    }
    return map;
  }, [tasks]);

  function getTasksForDay(day: Date) {
    return tasksByDay.get(format(day, "yyyy-MM-dd")) ?? [];
  }

  const handleDayClick = (day: Date, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (onCreateTaskAt) {
      const d = new Date(day);
      d.setHours(9, 0, 0, 0); // Default to 9am in Month view
      onCreateTaskAt(d);
    }
  };

  const gridTemplateColumns = "repeat(7, minmax(100px, 1fr))";

  return (
    <div className="h-full overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div
        className="grid min-h-full min-w-[700px]"
        style={{
          gridTemplateColumns,
          gridTemplateRows: `auto repeat(${Math.ceil(allDays.length / 7)}, minmax(100px, 1fr))`,
        }}
      >
        {/* HEADERS */}
        {DAY_HEADERS.map((d, i) => (
          <div
            key={d}
            className="text-caption sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-surface)] py-3 text-center font-semibold tracking-widest text-[var(--color-text-3)] uppercase"
            style={{ gridColumn: i + 1, gridRow: 1 }}
          >
            {d}
          </div>
        ))}

        {/* CELLS */}
        {allDays.map((day, index) => {
          const dayTasks = getTasksForDay(day);
          const visible = dayTasks.slice(0, MAX_VISIBLE);
          const overflow = dayTasks.length - MAX_VISIBLE;
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);
          const isPopoverOpen = popoverDay && isSameDay(popoverDay, day);
          const isBottomRow = Math.floor(index / 7) >= 4;

          const col = (index % 7) + 1;
          const row = Math.floor(index / 7) + 2;

          return (
            <DroppableDay
              key={day.toISOString()}
              id={`date-${format(day, "yyyy-MM-dd")}`}
              dayIndex={index}
              onClick={() => handleDayClick(day)}
              ariaLabel={`Calendar day ${format(day, "EEEE, MMMM d, yyyy")}, ${dayTasks.length} task${dayTasks.length === 1 ? "" : "s"}`}
              className={cn(
                "relative cursor-pointer border-r border-b border-[var(--color-border)] p-1.5 hover:bg-[rgba(255,255,255,0.02)]",
                !isCurrentMonth && "opacity-40",
                today && "bg-[var(--accent)]/[0.04]",
                col === 7 && "border-r-0",
              )}
              style={{ gridColumn: col, gridRow: row }}
            >
              <div className="mb-1.5 flex items-center justify-between">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDayClick(day);
                  }}
                  tabIndex={-1} // Handled by parent div
                  className={cn(
                    "pointer-events-none flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors",
                    today
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--color-text-2)]",
                  )}
                >
                  {format(day, "d")}
                </button>
              </div>

              <div className="space-y-0.5">
                {visible.map((task) => (
                  <CalendarTaskChip
                    key={task.id}
                    task={task}
                    variant="month"
                    onEdit={onEditTask}
                  />
                ))}
                {overflow > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPopoverDay(
                        isSameDay(day, popoverDay ?? new Date(0)) ? null : day,
                      );
                    }}
                    aria-label={`Show all ${dayTasks.length} tasks for ${format(day, "MMMM d")}`}
                    aria-expanded={!!isPopoverOpen}
                    className="text-caption w-full rounded px-1.5 py-0.5 text-left font-semibold text-[var(--accent)] hover:underline focus-visible:bg-[rgba(255,255,255,0.08)] focus-visible:outline-none"
                  >
                    +{overflow} more
                  </button>
                )}
              </div>

              {isPopoverOpen && (
                <DayPopover
                  date={day}
                  tasks={dayTasks}
                  onClose={() => setPopoverDay(null)}
                  onEditTask={onEditTask}
                  isBottomRow={isBottomRow}
                />
              )}
            </DroppableDay>
          );
        })}
      </div>
    </div>
  );
}
