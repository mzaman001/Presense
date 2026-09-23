"use client";

import React, { useState, useCallback, useEffect } from "react";
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
import { MobileCalendar } from "./MobileCalendar";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { createClient, safeMutate } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

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
      "week",
    ),
  );
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  // Phones get their own agenda-style calendar (MobileCalendar) instead of
  // the 700–800px desktop grids — every sub-view works at every width now,
  // so nothing forces "day" any more.
  const isPhone = useMediaQuery("(max-width: 767px)");

  // Restore the last-used range after hydration. Reading localStorage during
  // render made server and client disagree (a hydration mismatch). An
  // explicit ?subview= in the URL still wins.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("subview")) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("presense_calendar_view");
    } catch {
      return;
    }
    if (stored === "day" || stored === "month") void setSubView(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (isPhone) return format(currentDate, "MMMM yyyy");
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
              const { success } = await safeMutate(
                () =>
                  supabase
                    .from("items")
                    .update({ deadline: previousDeadline })
                    .eq("id", taskId),
                "Failed to undo reschedule",
              );
              if (!success) {
                queryClient.setQueryData<Task[]>(["tasks"], (old) =>
                  old?.map((t) =>
                    t.id === taskId ? { ...t, deadline: newDeadlineISO } : t,
                  ),
                );
                return;
              }
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
        if (event.target !== event.currentTarget || event.defaultPrevented)
          return;
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
      <div className="mb-5 flex shrink-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-1">
          <h2 className="font-heading mr-auto min-w-0 truncate text-[length:var(--text-title-lg)] font-medium text-[var(--text-1)] md:mr-3">
            {getHeaderLabel()}
          </h2>
          <button
            type="button"
            onClick={navigatePrev}
            aria-label={`Previous ${subView}`}
            className="flex size-9 items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
          >
            <UiIcon size={18} icon={ChevronLeft} />
          </button>
          <button
            type="button"
            onClick={navigateNext}
            aria-label={`Next ${subView}`}
            className="flex size-9 items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
          >
            <UiIcon size={18} icon={ChevronRight} />
          </button>
          <button
            type="button"
            onClick={navigateToday}
            className="chip chip-sm ml-1"
          >
            Today
          </button>
        </div>

        <SegmentedControl<CalendarSubView>
          label="Calendar range"
          className="segmented-fill md:w-auto"
          value={subView}
          onChange={(v) => {
            setSubView(v);
            try {
              localStorage.setItem("presense_calendar_view", v);
            } catch {
              // Storage can be unavailable (private mode); the choice just
              // won't persist across reloads.
            }
          }}
          options={[
            { label: "Day", value: "day" },
            { label: "Week", value: "week" },
            { label: "Month", value: "month" },
          ]}
        />
      </div>

      {isPhone ? (
        <MobileCalendar
          subView={subView}
          currentDate={currentDate}
          onSelectDate={setCurrentDate}
          tasks={filteredTasks}
          onEditTask={onEditTask}
          onCreateTaskAt={onCreateTaskAt}
        />
      ) : (
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
      )}
    </div>
  );
}
