"use client";

import React, { useMemo } from "react";
import { m } from "framer-motion";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Plus } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { resolveCategoryColor } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/calendar";

type SubView = "day" | "week" | "month";

interface MobileCalendarProps {
  subView: SubView;
  currentDate: Date;
  onSelectDate: (date: Date) => void;
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onCreateTaskAt?: (deadline: Date) => void;
}

const WEEK_OPTS = { weekStartsOn: 1 as const };

const isAllDay = (d: Date) => d.getHours() === 0 && d.getMinutes() === 0;

/**
 * The phone calendar. The desktop week/month grids need 700–800px, so on a
 * phone they were replaced by a forced single-day hour grid with no way to
 * switch. This is the pattern phone calendars use instead:
 *
 *  - Day:   a strip of the week's days to hop between, and that day's
 *           agenda.
 *  - Week:  the same strip, and the whole week as a day-by-day agenda.
 *  - Month: a compact month grid with a dot per task; the selected day's
 *           agenda sits under it.
 */
export function MobileCalendar({
  subView,
  currentDate,
  onSelectDate,
  tasks,
  onEditTask,
  onCreateTaskAt,
}: MobileCalendarProps) {
  const categoryColors = useAppStore((s) => s.userSettings?.do_category_colors);

  // Index once: yyyy-MM-dd → tasks sorted by time (all-day first).
  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!t.deadline) continue;
      const key = format(parseISO(t.deadline), "yyyy-MM-dd");
      const list = map.get(key);
      if (list) list.push(t);
      else map.set(key, [t]);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          parseISO(a.deadline!).getTime() - parseISO(b.deadline!).getTime(),
      );
    }
    return map;
  }, [tasks]);

  const tasksOn = (day: Date) => byDay.get(format(day, "yyyy-MM-dd")) ?? [];
  const colorOf = (t: Task) =>
    resolveCategoryColor(t.category, categoryColors, "var(--text-3)");

  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentDate, WEEK_OPTS),
    end: endOfWeek(currentDate, WEEK_OPTS),
  });

  return (
    <div className="space-y-5">
      {subView === "month" ? (
        <MonthGrid
          currentDate={currentDate}
          onSelect={onSelectDate}
          tasksOn={tasksOn}
          colorOf={colorOf}
        />
      ) : (
        <WeekStrip
          days={weekDays}
          selected={currentDate}
          onSelect={onSelectDate}
          tasksOn={tasksOn}
        />
      )}

      {subView === "week" ? (
        <div className="space-y-5">
          {weekDays.map((day) => (
            <DayAgenda
              key={day.toISOString()}
              day={day}
              tasks={tasksOn(day)}
              colorOf={colorOf}
              onEditTask={onEditTask}
              onCreateTaskAt={onCreateTaskAt}
              compact
            />
          ))}
        </div>
      ) : (
        <DayAgenda
          day={currentDate}
          tasks={tasksOn(currentDate)}
          colorOf={colorOf}
          onEditTask={onEditTask}
          onCreateTaskAt={onCreateTaskAt}
        />
      )}
    </div>
  );
}

function WeekStrip({
  days,
  selected,
  onSelect,
  tasksOn,
}: {
  days: Date[];
  selected: Date;
  onSelect: (d: Date) => void;
  tasksOn: (d: Date) => Task[];
}) {
  return (
    <div
      role="group"
      aria-label="Days this week"
      className="grid grid-cols-7 gap-1"
    >
      {days.map((day) => {
        const isSelected = isSameDay(day, selected);
        const count = tasksOn(day).length;
        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onSelect(day)}
            aria-pressed={isSelected}
            aria-label={`${format(day, "EEEE d MMMM")}${count ? `, ${count} task${count === 1 ? "" : "s"}` : ""}`}
            className="flex flex-col items-center gap-1 rounded-[var(--radius-md)] py-1.5 transition-colors active:bg-[var(--surface-hover)]"
          >
            <span className="text-[length:var(--text-caption)] font-medium text-[var(--text-3)] uppercase">
              {format(day, "EEEEE")}
            </span>
            <span
              className={cn(
                "relative flex size-9 items-center justify-center rounded-full text-[length:var(--text-body-lg)] font-medium tabular-nums transition-colors",
                isSelected
                  ? "text-[var(--text-on-accent)]"
                  : isToday(day)
                    ? "text-[var(--accent-text)]"
                    : "text-[var(--text-1)]",
              )}
            >
              {isSelected && (
                <m.span
                  layoutId="mobile-cal-day"
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-[var(--accent)]"
                  transition={{ type: "spring", stiffness: 520, damping: 46 }}
                />
              )}
              <span className="relative">{format(day, "d")}</span>
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "size-1 rounded-full",
                count ? "bg-[var(--text-3)]" : "bg-transparent",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

function MonthGrid({
  currentDate,
  onSelect,
  tasksOn,
  colorOf,
}: {
  currentDate: Date;
  onSelect: (d: Date) => void;
  tasksOn: (d: Date) => Task[];
  colorOf: (t: Task) => string;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate), WEEK_OPTS),
    end: endOfWeek(endOfMonth(currentDate), WEEK_OPTS),
  });
  const weekdayLetters = days.slice(0, 7).map((d) => format(d, "EEEEE"));

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-2">
      <div aria-hidden="true" className="grid grid-cols-7 pb-1">
        {weekdayLetters.map((l, i) => (
          <span
            key={i}
            className="py-1 text-center text-[length:var(--text-caption)] font-medium text-[var(--text-3)]"
          >
            {l}
          </span>
        ))}
      </div>
      <div
        role="group"
        aria-label={format(currentDate, "MMMM yyyy")}
        className="grid grid-cols-7"
      >
        {days.map((day) => {
          const inMonth = isSameMonth(day, currentDate);
          const isSelected = isSameDay(day, currentDate);
          const dayTasks = tasksOn(day);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect(day)}
              aria-pressed={isSelected}
              aria-label={`${format(day, "EEEE d MMMM")}${dayTasks.length ? `, ${dayTasks.length} task${dayTasks.length === 1 ? "" : "s"}` : ""}`}
              className="flex h-12 flex-col items-center justify-start gap-0.5 rounded-[var(--radius-sm)] pt-1 active:bg-[var(--surface-hover)]"
            >
              <span
                className={cn(
                  "relative flex size-8 items-center justify-center rounded-full text-[length:var(--text-body)] tabular-nums",
                  isSelected
                    ? "font-semibold text-[var(--text-on-accent)]"
                    : isToday(day)
                      ? "font-semibold text-[var(--accent-text)]"
                      : inMonth
                        ? "text-[var(--text-1)]"
                        : "text-[var(--text-decorative)]",
                )}
              >
                {isSelected && (
                  <m.span
                    layoutId="mobile-cal-month-day"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-[var(--accent)]"
                    transition={{ type: "spring", stiffness: 520, damping: 46 }}
                  />
                )}
                <span className="relative">{format(day, "d")}</span>
              </span>
              <span
                aria-hidden="true"
                className="flex h-1.5 items-center gap-0.5"
              >
                {dayTasks.slice(0, 3).map((t) => (
                  <span
                    key={t.id}
                    className="size-1 rounded-full"
                    style={{ background: colorOf(t) }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayAgenda({
  day,
  tasks,
  colorOf,
  onEditTask,
  onCreateTaskAt,
  compact,
}: {
  day: Date;
  tasks: Task[];
  colorOf: (t: Task) => string;
  onEditTask: (task: Task) => void;
  onCreateTaskAt?: (deadline: Date) => void;
  compact?: boolean;
}) {
  const heading = isToday(day)
    ? "Today"
    : isSameDay(day, addDays(new Date(), 1))
      ? "Tomorrow"
      : format(day, "EEEE");

  return (
    <section aria-label={format(day, "EEEE d MMMM")}>
      <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
        <h3 className="flex items-baseline gap-2">
          <span
            className={cn(
              "font-heading text-[length:var(--text-title-md)] font-medium",
              isToday(day)
                ? "text-[var(--accent-text)]"
                : "text-[var(--text-1)]",
            )}
          >
            {heading}
          </span>
          <span className="text-[length:var(--text-ui)] text-[var(--text-3)]">
            {format(day, "d MMM")}
          </span>
          {compact && tasks.length === 0 && (
            <span className="text-[length:var(--text-ui)] text-[var(--text-decorative)]">
              · Free
            </span>
          )}
        </h3>
        {onCreateTaskAt && (
          <button
            type="button"
            onClick={() => {
              const at = new Date(day);
              at.setHours(9, 0, 0, 0);
              onCreateTaskAt(at);
            }}
            aria-label={`Add a task on ${format(day, "EEEE d MMMM")}`}
            className="-mr-2 flex size-9 items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
          >
            <Plus aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>

      {tasks.length === 0 ? (
        compact ? null : (
          <p
            className={cn(
              "rounded-[var(--radius-lg)] border border-dashed border-[var(--border-subtle)] px-4 text-[length:var(--text-body)] text-[var(--text-3)]",
              "py-8 text-center",
            )}
          >
            A clear day. Nothing scheduled.
          </p>
        )
      ) : (
        <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)]">
          {tasks.map((t, i) => {
            const d = parseISO(t.deadline!);
            return (
              <li
                key={t.id}
                className={cn(
                  i > 0 && "border-t border-[var(--border-subtle)]",
                )}
              >
                <button
                  type="button"
                  onClick={() => onEditTask(t)}
                  className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors active:bg-[var(--surface-hover)]"
                >
                  <span className="w-[4.25rem] shrink-0 text-[length:var(--text-meta)] whitespace-nowrap text-[var(--text-3)] tabular-nums">
                    {isAllDay(d) ? "All day" : format(d, "h:mm a")}
                  </span>
                  <span
                    aria-hidden="true"
                    className="h-8 w-[3px] shrink-0 rounded-full"
                    style={{ background: colorOf(t) }}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-[length:var(--text-body-lg)] text-[var(--text-1)]",
                        t.status === "done" &&
                          "text-[var(--text-3)] line-through",
                      )}
                    >
                      {t.title}
                    </span>
                    {t.category && (
                      <span className="block truncate text-[length:var(--text-meta)] text-[var(--text-3)] capitalize">
                        {t.category}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
