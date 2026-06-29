"use client";

import React, { useEffect, useRef } from "react";
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
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

interface Task {
  id: string;
  title: string;
  deadline: string | null;
  status: string;
  category: string;
  priority?: number | null;
  first_step: string | null;
  ifthen_trigger: string | null;
  snoozed_until?: string | null;
  recurrence?: string | null;
  linked_people_ids?: string[] | null;
}

interface WeekViewProps {
  weekStart: Date;
  tasks: Task[];
  onEditTask: (task: Task) => void;
}

const HOUR_HEIGHT = 64; // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = 7;

/** Detects whether a task is "all-day" — deadline with no time (midnight 00:00:00 UTC or local) */
function isAllDayTask(deadline: string): boolean {
  const d = new Date(deadline);
  return d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;
}

function getTopOffset(deadline: string): number {
  const d = new Date(deadline);
  return (d.getHours() + d.getMinutes() / 60) * HOUR_HEIGHT;
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
  const isHalfHour = hour % 1 !== 0;

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        "border-t border-[rgba(255,255,255,0.04)] relative group cursor-pointer transition-colors",
        isOver ? "bg-[var(--accent-dim)]/20" : "hover:bg-[rgba(255,255,255,0.02)]"
      )}
      style={{ height: HOUR_HEIGHT }}
      title={`${format(dayDate, "EEE, MMM d")} at ${format(new Date().setHours(hour, 0, 0), "h:mm a")}`}
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
        isOver ? "bg-[var(--accent-dim)]/20" : ""
      )}
    >
      {children}
    </div>
  );
}

export function WeekView({ weekStart, tasks, onEditTask }: WeekViewProps) {
  const { setCaptureModalOpen, setCaptureModalPrefill } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = new Date();

  // Auto-scroll to 8am on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 8 * HOUR_HEIGHT - 48;
    }
  }, [weekStart]);

  const weekDays = Array.from({ length: DAYS }, (_, i) => addDays(weekStart, i));

  /** Split tasks by week day */
  function getTasksForDay(day: Date) {
    return tasks.filter((t) => {
      if (!t.deadline) return false;
      return isSameDay(parseISO(t.deadline), day);
    });
  }

  function handleSlotClick(day: Date, hour: number) {
    const dayName = format(day, "EEEE");
    const timeStr = format(new Date().setHours(hour, 0, 0, 0), "h:mm a");
    setCaptureModalPrefill(`on ${dayName} at ${timeStr}`);
    setCaptureModalOpen(true);
  }

  function handleAllDayClick(day: Date) {
    const dayStr = format(day, "EEEE, MMMM d");
    setCaptureModalPrefill(`on ${dayStr}`);
    setCaptureModalOpen(true);
  }

  // Current time indicator position
  const currentTimeTop = (now.getHours() + now.getMinutes() / 60) * HOUR_HEIGHT;

  return (
    <div className="flex flex-col h-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      {/* Column headers */}
      <div className="flex border-b border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] shrink-0">
        {/* Time gutter */}
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto relative">
        <div className="flex" style={{ height: HOUR_HEIGHT * 24 }}>
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

                {/* Task chips — absolutely positioned */}
                {dayTasksForColumn.map((task) => {
                  const top = task.deadline ? getTopOffset(task.deadline) : 0;
                  // Min height = 30 min worth of height
                  const minHeight = HOUR_HEIGHT / 2;
                  return (
                    <CalendarTaskChip
                      key={task.id}
                      task={task}
                      variant="week"
                      style={{
                        top,
                        minHeight,
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
