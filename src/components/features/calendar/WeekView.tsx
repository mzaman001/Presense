"use client";

import React, { useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import { CalendarTaskChip } from "./CalendarTaskChip";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

import { Task } from "@/types/calendar";

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

/** Detects whether a task is "all-day" — deadline with no time (midnight 00:00:00 UTC or local) */
function isAllDayTask(deadline: string): boolean {
  const d = new Date(deadline);
  return d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;
}

function getTopOffset(deadline: string): number {
  const d = new Date(deadline);
  return (d.getHours() + d.getMinutes() / 60) * HOUR_HEIGHT;
}

/** Calculates overlap layout for side-by-side rendering */
function calculateOverlap(tasks: Task[]) {
  // Sort by start time (hour + min)
  const sorted = [...tasks].sort((a, b) => {
    const dA = parseISO(a.deadline!);
    const dB = parseISO(b.deadline!);
    return dA.getTime() - dB.getTime();
  });

  const layout: { task: Task; left: number; width: number }[] = [];
  
  let columns: Task[][] = [];
  let lastEventEnding: number | null = null;

  function packColumns() {
    const numColumns = columns.length;
    columns.forEach((col, colIdx) => {
      col.forEach((task) => {
        layout.push({
          task,
          left: (colIdx / numColumns) * 100,
          width: (1 / numColumns) * 100,
        });
      });
    });
  }

  sorted.forEach((task) => {
    const d = parseISO(task.deadline!);
    const start = d.getHours() + d.getMinutes() / 60;
    const end = start + 1; // standard block assumption for overlapping calculation

    if (lastEventEnding !== null && start >= lastEventEnding) {
      packColumns();
      columns = [];
      lastEventEnding = null;
    }

    let placed = false;
    for (const col of columns) {
      const lastInCol = col[col.length - 1];
      const lastStart =
        parseISO(lastInCol.deadline!).getHours() +
        parseISO(lastInCol.deadline!).getMinutes() / 60;
      
      // If start is >= lastStart + 1 hour (assuming 1h duration), we can place it underneath.
      // But for pure vertical columns, a task can be in this column only if it starts after the previous ends.
      // To keep it simple, React Big Calendar does this:
      if (start >= lastStart + (lastInCol.time_estimate ? lastInCol.time_estimate / 60 : 1)) {
        col.push(task);
        placed = true;
        break;
      }
    }
    if (!placed) columns.push([task]);

    lastEventEnding = Math.max(lastEventEnding || 0, end);
  });

  if (columns.length > 0) packColumns();
  return layout;
}

/** Droppable slot for individual hour cells */
function DroppableSlot({
  id,
  hour,
  dayDate,
  onClick,
}: {
  id: string;
  hour: number;
  dayDate: Date;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        "border-t border-[rgba(255,255,255,0.04)] relative group cursor-pointer transition-colors",
        isOver ? "bg-[var(--accent)]/10" : "hover:bg-[rgba(255,255,255,0.04)]"
      )}
      style={{ height: HOUR_HEIGHT }}
    >
      {/* Half-hour subdivision line */}
      <div className="absolute top-1/2 left-0 right-0 border-t border-[rgba(255,255,255,0.02)]" />
      {/* Plus icon appears on hover */}
      <Plus
        size={12}
        className="absolute top-1 right-1 text-[var(--color-text-3)] opacity-0 group-hover:opacity-60 transition-opacity"
      />
    </div>
  );
}

/** Droppable all-day zone for a specific day */
function DroppableAllDay({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 min-h-[32px] p-1 space-y-0.5 rounded transition-colors",
        isOver ? "bg-[var(--accent)]/10" : ""
      )}
    >
      {children}
    </div>
  );
}

export function WeekView({ weekStart, tasks, onEditTask, onCreateTaskAt, days = DAYS }: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [now, setNow] = useState(new Date());
  const [currentTimeTop, setCurrentTimeTop] = useState(() => {
    const d = new Date();
    return (d.getHours() + d.getMinutes() / 60) * HOUR_HEIGHT;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date();
      setNow(d);
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

  const weekDays = Array.from({ length: days }, (_, i) => addDays(weekStart, i));

  /** Split tasks by week day */
  function getTasksForDay(day: Date) {
    return tasks.filter((t) => {
      if (!t.deadline) return false;
      return isSameDay(parseISO(t.deadline), day);
    });
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

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Column headers */}
      <div className="flex border-b border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] shrink-0">
        <div className="w-14 shrink-0" />
        {weekDays.map((day) => {
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className="flex-1 text-center py-3 border-l border-[var(--color-border)] first:border-l-0"
            >
              <p
                className={cn(
                  "text-[10px] uppercase tracking-widest font-semibold",
                  today ? "text-[var(--accent)]" : "text-[var(--color-text-3)]"
                )}
              >
                {format(day, "EEE")}
              </p>
              <div
                className={cn(
                  "text-lg font-bold mt-0.5 w-9 h-9 rounded-full mx-auto flex items-center justify-center",
                  today
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--color-text-1)]"
                )}
              >
                {format(day, "d")}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-Day row */}
      <div className="flex border-b border-[var(--color-border)] bg-[rgba(255,255,255,0.01)] shrink-0">
        <div className="w-14 shrink-0 flex items-center justify-end pr-2">
          <span className="text-[9px] uppercase tracking-widest text-[var(--color-text-3)] font-semibold">
            All day
          </span>
        </div>
        {weekDays.map((day) => {
          const dayTasks = getTasksForDay(day).filter(
            (t) => t.deadline && isAllDayTask(t.deadline)
          );
          return (
            <div
              key={day.toISOString()}
              className="flex-1 border-l border-[var(--color-border)] first:border-l-0"
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
      </div>

      {/* Scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-auto relative">
        <div className={cn("flex", days === 1 ? "min-w-0" : "min-w-[800px]")} style={{ height: HOUR_HEIGHT * 24 }}>
          {/* Time labels */}
          <div className="w-14 shrink-0 relative">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute right-2 text-[10px] text-[var(--color-text-3)] font-medium leading-none"
                style={{ top: hour * HOUR_HEIGHT - 6, display: hour === 0 ? "none" : "block" }}
              >
                {format(new Date().setHours(hour, 0, 0, 0), "h a")}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day) => {
            const dayTasksForColumn = getTasksForDay(day).filter(
              (t) => t.deadline && !isAllDayTask(t.deadline)
            );
            const isCurrentDay = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "flex-1 border-l border-[var(--color-border)] relative",
                  isCurrentDay && "bg-[var(--accent)]/[0.02]"
                )}
              >
                {/* Hour slots — droppable targets */}
                {HOURS.map((hour) => (
                  <DroppableSlot
                    key={hour}
                    id={`slot-${format(day, "yyyy-MM-dd")}-${String(hour).padStart(2, "0")}-00`}
                    hour={hour}
                    dayDate={day}
                    onClick={() => handleSlotClick(day, hour)}
                  />
                ))}

                {/* Current time indicator */}
                {isCurrentDay && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none"
                    style={{ top: currentTimeTop }}
                  >
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0 -ml-1" />
                      <div className="flex-1 h-[1.5px] bg-[var(--accent)]" />
                    </div>
                  </div>
                )}

                {/* Task chips — absolutely positioned with overlap layout */}
                {calculateOverlap(dayTasksForColumn).map(({ task, left, width }) => {
                  const top = task.deadline ? getTopOffset(task.deadline) : 0;
                  const estimatedMinutes = (task.time_estimate as number) || 30; // fallback to 30 min height
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
                        zIndex: 10,
                      }}
                      onEdit={onEditTask}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
