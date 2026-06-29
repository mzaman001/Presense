"use client";

import React, { useState } from "react";
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
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

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

interface MonthViewProps {
  currentMonth: Date;
  tasks: Task[];
  onEditTask: (task: Task) => void;
}

const MAX_VISIBLE = 3;
const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function DroppableDay({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "transition-colors",
        isOver && "bg-[var(--accent-dim)]/20",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Popover showing all tasks for a specific day */
function DayPopover({
  date,
  tasks,
  onClose,
  onEditTask,
}: {
  date: Date;
  tasks: Task[];
  onClose: () => void;
  onEditTask: (task: Task) => void;
}) {
  return (
    <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-2xl p-3 space-y-1.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[var(--color-text-1)]">
          {format(date, "EEEE, MMMM d")}
        </span>
        <button
          onClick={onClose}
          className="text-[var(--color-text-3)] hover:text-[var(--color-text-1)] p-0.5 rounded"
        >
          <X size={12} />
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

export function MonthView({ currentMonth, tasks, onEditTask }: MonthViewProps) {
  const { setCaptureModalOpen, setCaptureModalPrefill } = useAppStore();
  const [popoverDay, setPopoverDay] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  // Get full grid — pad with days from prev/next month
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  function getTasksForDay(day: Date): Task[] {
    return tasks.filter((t) => {
      if (!t.deadline) return false;
      try {
        return isSameDay(parseISO(t.deadline), day);
      } catch {
        return false;
      }
    });
  }

  function handleDayClick(day: Date, e: React.MouseEvent) {
    e.stopPropagation();
    const dayStr = format(day, "EEEE, MMMM d");
    setCaptureModalPrefill(`on ${dayStr}`);
    setCaptureModalOpen(true);
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
      onClick={() => setPopoverDay(null)}
    >
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] shrink-0">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="py-3 text-center text-[10px] uppercase tracking-widest font-semibold text-[var(--color-text-3)]"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 auto-rows-fr h-full">
          {allDays.map((day) => {
            const dayTasks = getTasksForDay(day);
            const visible = dayTasks.slice(0, MAX_VISIBLE);
            const overflow = dayTasks.length - MAX_VISIBLE;
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);
            const isPopoverOpen = popoverDay && isSameDay(popoverDay, day);

            return (
              <DroppableDay
                key={day.toISOString()}
                id={`date-${format(day, "yyyy-MM-dd")}`}
                className={cn(
                  "border-b border-r border-[var(--color-border)] min-h-[100px] relative p-1.5",
                  !isCurrentMonth && "opacity-40",
                  today && "bg-[var(--accent)]/[0.04]"
                )}
              >
                {/* Date number */}
                <div className="flex items-center justify-between mb-1.5">
                  <button
                    onClick={(e) => handleDayClick(day, e)}
                    className={cn(
                      "w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-colors",
                      today
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--color-text-2)] hover:bg-[rgba(255,255,255,0.08)]"
                    )}
                  >
                    {format(day, "d")}
                  </button>
                </div>

                {/* Task chips */}
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
                        setPopoverDay(isSameDay(day, popoverDay ?? new Date(0)) ? null : day);
                      }}
                      className="text-[10px] font-semibold text-[var(--accent)] hover:underline w-full text-left px-1.5 py-0.5"
                    >
                      +{overflow} more
                    </button>
                  )}
                </div>

                {/* Overflow popover */}
                {isPopoverOpen && (
                  <DayPopover
                    date={day}
                    tasks={dayTasks}
                    onClose={() => setPopoverDay(null)}
                    onEditTask={onEditTask}
                  />
                )}
              </DroppableDay>
            );
          })}
        </div>
      </div>
    </div>
  );
}
