"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useDroppable } from "@dnd-kit/core";
import { format, addDays, isSameDay, isToday, parseISO } from "date-fns";
import { CalendarTaskChip } from "./CalendarTaskChip";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

import { Task } from "@/types/calendar";
import { useAppStore } from "@/store/useAppStore";
import { Icon as UiIcon } from "@/components/ui/Icon";

const HOUR_HEIGHT = 48; // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = 7;

interface WeekViewProps {
  weekStart: Date;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onCreateTaskAt?: (deadline: Date) => void;
  days?: number;
}

function isAllDayTask(deadline: string): boolean {
  const d = new Date(deadline);
  return d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;
}

function getTopOffset(deadline: string): number {
  const d = new Date(deadline);
  return (d.getHours() + d.getMinutes() / 60) * HOUR_HEIGHT;
}

// PERF-16: precomputed numeric start/end so the sort comparator and the
// per-column placement loop never re-parse deadline strings. Both phases
// read the single pass over the array.
function calculateOverlap(tasks: Task[]) {
  const timed = tasks.map((task) => {
    const d = new Date(task.deadline!);
    return {
      task,
      start: d.getHours() + d.getMinutes() / 60,
      duration: task.time_estimate ? task.time_estimate / 60 : 0.5,
    };
  });
  const sorted = timed.sort((a, b) => a.start - b.start);

  const layout: { task: Task; left: number; width: number }[] = [];
  let columns: { task: Task; start: number; duration: number }[][] = [];
  let lastEventEnding: number | null = null;

  function packColumns() {
    const numColumns = columns.length;
    columns.forEach((col, colIdx) => {
      col.forEach((entry) => {
        layout.push({
          task: entry.task,
          left: (colIdx / numColumns) * 100,
          width: (1 / numColumns) * 100,
        });
      });
    });
  }

  sorted.forEach((entry) => {
    const { start, duration } = entry;
    const end = start + duration;

    if (lastEventEnding !== null && start >= lastEventEnding) {
      packColumns();
      columns = [];
      lastEventEnding = null;
    }

    let placed = false;
    for (const col of columns) {
      const lastInCol = col[col.length - 1];
      if (start >= lastInCol.start + lastInCol.duration) {
        col.push(entry);
        placed = true;
        break;
      }
    }
    if (!placed) columns.push([entry]);

    lastEventEnding = Math.max(lastEventEnding || 0, end);
  });

  if (columns.length > 0) packColumns();
  return layout;
}

function DroppableSlot({
  id,
  hour,
  dayIndex,
  dayDate,
  onClick,
}: {
  id: string;
  hour: number;
  dayIndex: number;
  dayDate: Date;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const nextHour = Math.max(0, hour - 1);
      (
        document.querySelector(
          `[data-slot-day="${dayIndex}"][data-slot-hour="${nextHour}"]`,
        ) as HTMLElement
      )?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextHour = Math.min(23, hour + 1);
      (
        document.querySelector(
          `[data-slot-day="${dayIndex}"][data-slot-hour="${nextHour}"]`,
        ) as HTMLElement
      )?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevDay = dayIndex - 1;
      if (prevDay >= 0) {
        (
          document.querySelector(
            `[data-slot-day="${prevDay}"][data-slot-hour="${hour}"]`,
          ) as HTMLElement
        )?.focus();
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextDay = dayIndex + 1;
      (
        document.querySelector(
          `[data-slot-day="${nextDay}"][data-slot-hour="${hour}"]`,
        ) as HTMLElement
      )?.focus();
    }
  };

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      data-slot-day={dayIndex}
      data-slot-hour={hour}
      className={cn(
        "group relative cursor-pointer border-t border-[var(--border-subtle)] transition-colors outline-none focus:bg-[var(--surface-active)]",
        isOver ? "bg-[var(--accent)]/10" : "hover:bg-[var(--surface-2)]",
      )}
      style={{ height: HOUR_HEIGHT }}
    >
      <div className="pointer-events-none absolute top-1/2 right-0 left-0 border-t border-[var(--border-subtle)]" />
      <UiIcon
        size={12}
        className="row-actions absolute top-1 right-1 text-[var(--color-text-3)]"
        icon={Plus}
      />
    </div>
  );
}

function DroppableAllDay({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[32px] flex-1 space-y-0.5 rounded p-1 transition-colors",
        isOver ? "bg-[var(--accent)]/10" : "",
      )}
    >
      {children}
    </div>
  );
}

export function WeekView({
  weekStart,
  tasks,
  onEditTask,
  onCreateTaskAt,
  days = DAYS,
}: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const [currentTimeTop, setCurrentTimeTop] = useState(() => {
    const d = new Date();
    return (d.getHours() + d.getMinutes() / 60) * HOUR_HEIGHT;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date();
      setCurrentTimeTop((d.getHours() + d.getMinutes() / 60) * HOUR_HEIGHT);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to 8am on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 8 * HOUR_HEIGHT - 48;
    }
  }, [weekStart]);

  const viewDays = Array.from({ length: days }, (_, i) =>
    addDays(weekStart, i),
  );

  // PERF-16: index tasks by their deadline day once per render instead of
  // scanning the full list + parsing deadlines for all-day rows, timed
  // columns, and the overlap layout on every render (compounded by the
  // parent's 60 s clock refresh).
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

  function handleSlotClick(day: Date, hour: number) {
    const deadline = new Date(day);
    deadline.setHours(hour, 0, 0, 0);
    onCreateTaskAt?.(deadline);
  }

  function handleAllDayClick(day: Date) {
    const deadline = new Date(day);
    deadline.setHours(0, 0, 0, 0);
    onCreateTaskAt?.(deadline);
  }

  // CSS Grid approach:
  // Column 1 = 56px
  // Columns 2 to N+1 = 1fr (minmax)
  const gridTemplateColumns = `56px repeat(${days}, minmax(${days === 1 ? "0" : "100px"}, 1fr))`;

  return (
    <div
      ref={scrollRef}
      className="relative h-full overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
      tabIndex={-1}
    >
      <div
        className={cn(
          "grid min-h-full",
          days === 7 ? "min-w-[800px]" : "min-w-[300px]",
        )}
        style={{
          gridTemplateColumns,
          gridTemplateRows: `auto auto repeat(24, ${HOUR_HEIGHT}px)`,
        }}
      >
        {/* TOP-LEFT CORNER (Sticky Z-40) */}
        <div className="sticky top-0 left-0 z-40 border-r border-b border-[var(--color-border)] bg-[var(--color-surface)]" />

        {/* DAY HEADERS (Sticky Z-30) */}
        {viewDays.map((day, i) => {
          const today = isToday(day);
          return (
            <div
              key={`header-${day.toISOString()}`}
              className="sticky top-0 z-30 border-r border-b border-[var(--color-border)] bg-[var(--color-surface)] py-3 text-center last:border-r-0"
              style={{ gridColumn: i + 2, gridRow: 1 }}
            >
              <p
                className={cn(
                  "text-caption font-semibold tracking-widest uppercase",
                  today ? "text-[var(--accent)]" : "text-[var(--color-text-3)]",
                )}
              >
                {format(day, "EEE")}
              </p>
              <div
                className={cn(
                  "mx-auto mt-0.5 flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold",
                  today
                    ? "bg-[var(--accent)] text-[var(--text-on-accent)]"
                    : "text-[var(--color-text-1)]",
                )}
              >
                {format(day, "d")}
              </div>
            </div>
          );
        })}

        {/* ALL DAY LABEL (Sticky Z-30) */}
        <div
          className="sticky left-0 z-30 flex items-center justify-end border-r border-b border-[var(--color-border)] bg-[var(--color-surface)] py-2 pr-2"
          style={{ gridColumn: 1, gridRow: 2, top: 76 }}
        >
          <span className="text-caption font-semibold tracking-wider text-[var(--color-text-3)] uppercase">
            All day
          </span>
        </div>

        {/* ALL DAY CELLS (Sticky Z-20 vertically, flow horizontally) */}
        {viewDays.map((day, i) => {
          const dayTasks = getTasksForDay(day).filter(
            (t) => t.deadline && isAllDayTask(t.deadline),
          );
          return (
            <div
              key={`allday-${day.toISOString()}`}
              className="sticky z-20 border-r border-b border-[var(--color-border)] bg-[var(--color-surface)] last:border-r-0"
              style={{ gridColumn: i + 2, gridRow: 2, top: 76 }}
              onClick={() => handleAllDayClick(day)}
            >
              <DroppableAllDay id={`allday-${format(day, "yyyy-MM-dd")}`}>
                {dayTasks.map((task) => (
                  <CalendarTaskChip
                    key={task.id}
                    task={task}
                    variant="allday"
                    onEdit={onEditTask}
                  />
                ))}
              </DroppableAllDay>
            </div>
          );
        })}

        {/* TIME LABELS (Sticky Left Z-20) */}
        {HOURS.map((hour) => (
          <div
            key={`time-${hour}`}
            className="relative sticky left-0 z-20 border-r border-[var(--color-border)] bg-[var(--color-surface)]"
            style={{ gridColumn: 1, gridRow: hour + 3 }}
          >
            {hour > 0 && (
              <span className="text-caption absolute -top-2.5 right-2 leading-none font-medium text-[var(--color-text-3)]">
                {format(new Date().setHours(hour, 0, 0, 0), "h a")}
              </span>
            )}
          </div>
        ))}

        {/* DAY COLUMNS (Z-10) */}
        {viewDays.map((day, i) => {
          const dayTasksForColumn = getTasksForDay(day).filter(
            (t) => t.deadline && !isAllDayTask(t.deadline),
          );
          const isCurrentDay = isToday(day);

          return (
            <div
              key={`col-${day.toISOString()}`}
              className={cn(
                "relative border-r border-[var(--color-border)] last:border-r-0",
                isCurrentDay && "bg-[var(--accent)]/[0.02]",
              )}
              style={{ gridColumn: i + 2, gridRow: "3 / span 24" }}
            >
              {/* The 24 droppable slots */}
              {HOURS.map((hour) => (
                <DroppableSlot
                  key={hour}
                  id={`slot-${format(day, "yyyy-MM-dd")}-${String(hour).padStart(2, "0")}-00`}
                  hour={hour}
                  dayIndex={i}
                  dayDate={day}
                  onClick={() => handleSlotClick(day, hour)}
                />
              ))}

              {/* Current time indicator */}
              {isCurrentDay && (
                <div
                  className="pointer-events-none absolute right-0 left-0 z-20"
                  style={{ top: currentTimeTop }}
                >
                  <div className="flex items-center">
                    <div className="-ml-1 h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
                    <div className="h-[1.5px] flex-1 bg-[var(--accent)]" />
                  </div>
                </div>
              )}

              {/* Absolute positioned tasks */}
              {calculateOverlap(dayTasksForColumn).map(
                ({ task, left, width }) => {
                  const top = task.deadline ? getTopOffset(task.deadline) : 0;
                  const estimatedMinutes = (task.time_estimate as number) || 30;
                  const minHeight = (estimatedMinutes / 60) * HOUR_HEIGHT;

                  return (
                    <CalendarTaskChip
                      key={task.id}
                      task={task}
                      variant="week"
                      style={{
                        top,
                        left: `${left}%`,
                        width: `${width}%`,
                        height: Math.max(minHeight, 24),
                        minHeight: Math.max(minHeight, 24),
                        position: "absolute",
                        zIndex: 10,
                      }}
                      onEdit={onEditTask}
                    />
                  );
                },
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
