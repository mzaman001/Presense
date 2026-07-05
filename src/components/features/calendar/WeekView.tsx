"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  format,
  addDays,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import { CalendarTaskChip } from "./CalendarTaskChip";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

import { Task } from "@/types/calendar";
import { useAppStore } from "@/store/useAppStore";

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

function calculateOverlap(tasks: Task[]) {
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
    const end = start + (task.time_estimate ? task.time_estimate / 60 : 0.5);

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
      const lastDuration = lastInCol.time_estimate ? lastInCol.time_estimate / 60 : 0.5;
      
      if (start >= lastStart + lastDuration) {
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
      (document.querySelector(`[data-slot-day="${dayIndex}"][data-slot-hour="${nextHour}"]`) as HTMLElement)?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextHour = Math.min(23, hour + 1);
      (document.querySelector(`[data-slot-day="${dayIndex}"][data-slot-hour="${nextHour}"]`) as HTMLElement)?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevDay = dayIndex - 1;
      if (prevDay >= 0) {
        (document.querySelector(`[data-slot-day="${prevDay}"][data-slot-hour="${hour}"]`) as HTMLElement)?.focus();
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextDay = dayIndex + 1;
      (document.querySelector(`[data-slot-day="${nextDay}"][data-slot-hour="${hour}"]`) as HTMLElement)?.focus();
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
        "border-t border-[rgba(255,255,255,0.04)] relative group cursor-pointer transition-colors outline-none focus:bg-[rgba(255,255,255,0.08)]",
        isOver ? "bg-[var(--accent)]/10" : "hover:bg-[rgba(255,255,255,0.04)]"
      )}
      style={{ height: HOUR_HEIGHT }}
    >
      <div className="absolute top-1/2 left-0 right-0 border-t border-[rgba(255,255,255,0.02)] pointer-events-none" />
      <Plus
        size={12}
        className="absolute top-1 right-1 text-[var(--color-text-3)] opacity-0 group-hover:opacity-60 transition-opacity"
      />
    </div>
  );
}

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

  const viewDays = Array.from({ length: days }, (_, i) => addDays(weekStart, i));

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

  // CSS Grid approach:
  // Column 1 = 56px
  // Columns 2 to N+1 = 1fr (minmax)
  const gridTemplateColumns = `56px repeat(${days}, minmax(${days === 1 ? '0' : '100px'}, 1fr))`;

  return (
    <div 
      ref={scrollRef}
      className="h-full overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] relative"
      tabIndex={-1}
    >
      <div 
        className={cn("grid min-h-full", days === 7 ? "min-w-[800px]" : "min-w-[300px]")}
        style={{ 
          gridTemplateColumns, 
          gridTemplateRows: `auto auto repeat(24, ${HOUR_HEIGHT}px)` 
        }}
      >
        {/* TOP-LEFT CORNER (Sticky Z-40) */}
        <div className="sticky top-0 left-0 z-40 bg-[var(--color-surface)] border-b border-r border-[var(--color-border)]" />
        
        {/* DAY HEADERS (Sticky Z-30) */}
        {viewDays.map((day, i) => {
          const today = isToday(day);
          return (
            <div
              key={`header-${day.toISOString()}`}
              className="sticky top-0 z-30 bg-[var(--color-surface)] border-b border-r border-[var(--color-border)] text-center py-3 last:border-r-0"
              style={{ gridColumn: i + 2, gridRow: 1 }}
            >
              <p className={cn("text-caption uppercase tracking-widest font-semibold", today ? "text-[var(--accent)]" : "text-[var(--color-text-3)]")}>
                {format(day, "EEE")}
              </p>
              <div className={cn("text-lg font-bold mt-0.5 w-9 h-9 rounded-full mx-auto flex items-center justify-center", today ? "bg-[var(--accent)] text-white" : "text-[var(--color-text-1)]")}>
                {format(day, "d")}
              </div>
            </div>
          );
        })}

        {/* ALL DAY LABEL (Sticky Z-30) */}
        <div className="sticky left-0 z-30 bg-[var(--color-surface)] border-b border-r border-[var(--color-border)] flex items-center justify-end pr-2 py-2" style={{ gridColumn: 1, gridRow: 2, top: 76 }}>
          <span className="text-[9px] uppercase tracking-widest text-[var(--color-text-3)] font-semibold">
            All day
          </span>
        </div>

        {/* ALL DAY CELLS (Sticky Z-20 vertically, flow horizontally) */}
        {viewDays.map((day, i) => {
          const dayTasks = getTasksForDay(day).filter(t => t.deadline && isAllDayTask(t.deadline));
          return (
            <div
              key={`allday-${day.toISOString()}`}
              className="sticky z-20 bg-[var(--color-surface)] border-b border-r border-[var(--color-border)] last:border-r-0"
              style={{ gridColumn: i + 2, gridRow: 2, top: 76 }}
              onClick={() => handleAllDayClick(day)}
            >
              <DroppableAllDay id={`allday-${format(day, "yyyy-MM-dd")}`}>
                {dayTasks.map((task) => (
                  <CalendarTaskChip key={task.id} task={task} variant="allday" onEdit={onEditTask} />
                ))}
              </DroppableAllDay>
            </div>
          );
        })}

        {/* TIME LABELS (Sticky Left Z-20) */}
        {HOURS.map(hour => (
          <div
            key={`time-${hour}`}
            className="sticky left-0 z-20 bg-[var(--color-surface)] border-r border-[var(--color-border)] relative"
            style={{ gridColumn: 1, gridRow: hour + 3 }}
          >
            {hour > 0 && (
              <span className="absolute right-2 -top-2.5 text-caption text-[var(--color-text-3)] font-medium leading-none">
                {format(new Date().setHours(hour, 0, 0, 0), "h a")}
              </span>
            )}
          </div>
        ))}

        {/* DAY COLUMNS (Z-10) */}
        {viewDays.map((day, i) => {
          const dayTasksForColumn = getTasksForDay(day).filter(t => t.deadline && !isAllDayTask(t.deadline));
          const isCurrentDay = isToday(day);

          return (
            <div
              key={`col-${day.toISOString()}`}
              className={cn("relative border-r border-[var(--color-border)] last:border-r-0", isCurrentDay && "bg-[var(--accent)]/[0.02]")}
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
                <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: currentTimeTop }}>
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0 -ml-1" />
                    <div className="flex-1 h-[1.5px] bg-[var(--accent)]" />
                  </div>
                </div>
              )}

              {/* Absolute positioned tasks */}
              {calculateOverlap(dayTasksForColumn).map(({ task, left, width }) => {
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
                      position: 'absolute',
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
  );
}
