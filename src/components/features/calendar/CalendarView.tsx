"use client";

import React, { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  KeyboardSensor,
  closestCenter,
} from "@dnd-kit/core";
import {
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  format,
  parseISO,
} from "date-fns";
import { WeekView } from "./WeekView";
import { MonthView } from "./MonthView";
import { CalendarTaskChipOverlay } from "./CalendarTaskChip";
import { createClient } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

import { Task } from "@/types/calendar";
import { Icon as UiIcon } from "@/components/ui/Icon";
import { useQueryState, parseAsStringEnum } from "nuqs";

interface CalendarViewProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onCreateTaskAt?: (deadline: Date) => void;
  categoryFilter?: string;
}

type CalendarSubView = "day" | "week" | "month";

/** Parse the slot ID format `slot-YYYY-MM-DD-HH-MM` → Date */
function parseSlotId(id: string): Date | null {
  const parts = id.split("-");
  if (parts[0] !== "slot" || parts.length < 6) return null;
  const [, year, month, day, hour, minute] = parts;
  const d = new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    0,
    0,
  );
  return isNaN(d.getTime()) ? null : d;
}

/** Parse `allday-YYYY-MM-DD` → Date at midnight */
function parseAllDayId(id: string): Date | null {
  const parts = id.split("-");
  if (parts[0] !== "allday" || parts.length < 4) return null;
  const [, year, month, day] = parts;
  const d = new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    0,
    0,
    0,
    0,
  );
  return isNaN(d.getTime()) ? null : d;
}

/** Parse `date-YYYY-MM-DD` → Date at midnight (month view drop) */
function parseDateId(id: string): Date | null {
  const parts = id.split("-");
  if (parts[0] !== "date" || parts.length < 4) return null;
  const [, year, month, day] = parts;
  const d = new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    0,
    0,
    0,
    0,
  );
  return isNaN(d.getTime()) ? null : d;
}

export function CalendarView({
  tasks,
  onEditTask,
  onCreateTaskAt,
  categoryFilter,
}: CalendarViewProps) {
  const supabase = React.useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const [subView, setSubView] = useQueryState<CalendarSubView>(
    "subview",
    parseAsStringEnum<CalendarSubView>(["day", "week", "month"]).withDefault(
      typeof window !== "undefined" &&
        window.matchMedia("(max-width: 767px)").matches
        ? "day"
        : (typeof window !== "undefined" &&
            (localStorage.getItem(
              "presense_calendar_view",
            ) as CalendarSubView)) ||
            "week",
    ),
  );
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const filteredTasks = React.useMemo(() => {
    if (!categoryFilter || categoryFilter === "all") return tasks;
    return tasks.filter((t) => t.category === categoryFilter);
  }, [tasks, categoryFilter]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // require 8px movement before drag starts (prevents accidental drag on click)
      },
    }),
    useSensor(KeyboardSensor),
  );

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday

  const navigatePrev = () => {
    if (subView === "day") setCurrentDate(addDays(currentDate, -1));
    else if (subView === "week") setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subMonths(currentDate, 1));
  };

  const navigateNext = () => {
    if (subView === "day") setCurrentDate(addDays(currentDate, 1));
    else if (subView === "week") setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addMonths(currentDate, 1));
  };

  const navigateToday = () => setCurrentDate(new Date());

  const getHeaderLabel = () => {
    if (subView === "day") return format(currentDate, "EEEE, MMMM d, yyyy");
    if (subView === "week") {
      const weekEnd = addDays(weekStart, 6);
      if (format(weekStart, "MMM") === format(weekEnd, "MMM")) {
        return `${format(weekStart, "MMMM d")} – ${format(weekEnd, "d, yyyy")}`;
      }
      return `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;
    }
    return format(currentDate, "MMMM yyyy");
  };

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = tasks.find((t) => t.id === event.active.id);
      setActiveTask(task || null);
    },
    [tasks],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = event;
      if (!over || !active) return;

      const taskId = active.id as string;
      const dropId = over.id as string;
      const targetTask = tasks.find((t) => t.id === taskId);
      if (!targetTask) return;

      let newDeadline: Date | null = null;

      if (dropId.startsWith("slot-")) {
        newDeadline = parseSlotId(dropId);
      } else if (dropId.startsWith("allday-")) {
        newDeadline = parseAllDayId(dropId);
      } else if (dropId.startsWith("date-")) {
        // Month view drop: preserve time if task had a time, else midnight
        const targetDay = parseDateId(dropId);
        if (targetDay && targetTask.deadline) {
          const originalDate = parseISO(targetTask.deadline);
          newDeadline = new Date(
            targetDay.getFullYear(),
            targetDay.getMonth(),
            targetDay.getDate(),
            originalDate.getHours(),
            originalDate.getMinutes(),
            0,
            0,
          );
        } else {
          newDeadline = targetDay;
        }
      }

      if (!newDeadline) return;

      const previousDeadline = targetTask.deadline;
      const newDeadlineISO = newDeadline.toISOString();

      // Optimistic update
      queryClient.setQueryData<Task[]>(["tasks"], (old) =>
        old?.map((t) =>
          t.id === taskId ? { ...t, deadline: newDeadlineISO } : t,
        ),
      );

      try {
        useAppStore.getState().markMutation("items");
        const { error } = await supabase
          .from("items")
          .update({ deadline: newDeadlineISO })
          .eq("id", taskId);

        if (error) throw error;

        toast.success("Task rescheduled", {
          action: {
            label: "Undo",
            onClick: async () => {
              queryClient.setQueryData<Task[]>(["tasks"], (old) =>
                old?.map((t) =>
                  t.id === taskId ? { ...t, deadline: previousDeadline } : t,
                ),
              );
              await supabase
                .from("items")
                .update({ deadline: previousDeadline })
                .eq("id", taskId);
              toast.success("Reschedule undone");
            },
          },
          duration: 5000,
        });
      } catch (err: unknown) {
        // Rollback on error
        queryClient.setQueryData<Task[]>(["tasks"], (old) =>
          old?.map((t) =>
            t.id === taskId ? { ...t, deadline: previousDeadline } : t,
          ),
        );
        const message =
          err instanceof Error ? err.message : "Could not reschedule";
        toast.error("Failed to reschedule", { description: message });
      }
    },
    [tasks, queryClient, supabase],
  );

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "t") {
          event.preventDefault();
          navigateToday();
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          navigatePrev();
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          navigateNext();
        }
      }}
    >
      {/* Calendar toolbar */}
      <div className="mb-4 flex shrink-0 items-center justify-between">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={navigateToday}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-2)] transition-colors hover:bg-[var(--color-surface)]"
          >
            Today
          </button>
          <div className="flex items-center gap-0.5">
            <button
              onClick={navigatePrev}
              className="rounded-lg p-1.5 text-[var(--color-text-3)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text-1)]"
            >
              <UiIcon size={16} icon={ChevronLeft} />
            </button>
            <button
              onClick={navigateNext}
              className="rounded-lg p-1.5 text-[var(--color-text-3)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text-1)]"
            >
              <UiIcon size={16} icon={ChevronRight} />
            </button>
          </div>
          <h2 className="min-w-[200px] text-sm font-semibold text-[var(--color-text-1)]">
            {getHeaderLabel()}
          </h2>
        </div>

        {/* Week / Month toggle */}
        <div className="flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
          {(["day", "week", "month"] as CalendarSubView[]).map((v) => (
            <button
              key={v}
              onClick={() => {
                setSubView(v);
                localStorage.setItem("presense_calendar_view", v);
              }}
              className={cn(
                "rounded-full px-4 py-1 text-xs font-semibold capitalize transition-all",
                subView === v
                  ? "bg-[var(--color-text-1)] text-[var(--color-background)] shadow"
                  : "text-[var(--color-text-3)] hover:text-[var(--color-text-1)]",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* DndContext wraps both views */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-hidden">
          {subView === "day" ? (
            <WeekView
              weekStart={currentDate}
              tasks={filteredTasks}
              onEditTask={onEditTask}
              days={1}
              onCreateTaskAt={onCreateTaskAt}
            />
          ) : subView === "week" ? (
            <WeekView
              weekStart={weekStart}
              tasks={filteredTasks}
              onEditTask={onEditTask}
              onCreateTaskAt={onCreateTaskAt}
            />
          ) : (
            <MonthView
              currentMonth={currentDate}
              tasks={filteredTasks}
              onEditTask={onEditTask}
              onCreateTaskAt={onCreateTaskAt}
            />
          )}
        </div>

        {/* Ghost overlay shown while dragging */}
        <DragOverlay dropAnimation={null}>
          {activeTask ? <CalendarTaskChipOverlay task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
