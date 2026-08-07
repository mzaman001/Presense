"use client";

import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { DEFAULT_DO_COLORS } from "@/lib/constants";
import { format } from "date-fns";

import { Task } from "@/types/calendar";

interface CalendarTaskChipProps {
  task: Task;
  /** "week" = positioned chip in hourly grid, "month" = compact horizontal pill */
  variant: "week" | "month" | "allday";
  style?: React.CSSProperties;
  onEdit?: (task: Task) => void;
  isDragging?: boolean;
}

function getPriorityColor(priority: number | null | undefined): string {
  if (priority === 1) return "#ef4444";
  if (priority === 2) return "#eab308";
  if (priority === 3) return "#22c55e";
  return "";
}

export function CalendarTaskChip({
  task,
  variant,
  style,
  onEdit,
  isDragging = false,
}: CalendarTaskChipProps) {
  const userSettings = useAppStore((s) => s.userSettings);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: localDragging,
  } = useDraggable({
    id: task.id,
    data: { task },
  });

  const categoryColor =
    userSettings?.do_category_colors?.[task.category] ||
    DEFAULT_DO_COLORS[task.category] ||
    "var(--color-text-3)";

  const priorityColor = getPriorityColor(task.priority);

  const draggableStyle = {
    transform: CSS.Translate.toString(transform),
    ...style,
  };

  const isBeingDragged = localDragging || isDragging;
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      onEdit?.(task);
    }
  };
  const taskLabel = `Edit task: ${task.title}`;

  if (variant === "month") {
    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        role="button"
        tabIndex={0}
        aria-label={taskLabel}
        onClick={(e) => {
          e.stopPropagation();
          onEdit?.(task);
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          "text-caption flex w-full cursor-grab items-center gap-1 truncate rounded px-1.5 py-0.5 font-medium select-none active:cursor-grabbing",
          "transition-opacity",
          isBeingDragged ? "opacity-30" : "opacity-100",
        )}
        style={{
          ...draggableStyle,
          backgroundColor: `${categoryColor}22`,
          borderLeft: `2px solid ${categoryColor}`,
        }}
      >
        {priorityColor && (
          <span
            className="h-1 w-1 shrink-0 rounded-full"
            style={{ backgroundColor: priorityColor }}
          />
        )}
        <span className="truncate">{task.title}</span>
      </div>
    );
  }

  if (variant === "allday") {
    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        role="button"
        tabIndex={0}
        aria-label={taskLabel}
        onClick={(e) => {
          e.stopPropagation();
          onEdit?.(task);
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex cursor-grab items-center gap-1.5 truncate rounded-md px-2 py-1 text-xs font-medium select-none active:cursor-grabbing",
          "transition-opacity",
          isBeingDragged ? "opacity-30" : "opacity-100",
        )}
        style={{
          ...draggableStyle,
          backgroundColor: `${categoryColor}25`,
          borderLeft: `2.5px solid ${categoryColor}`,
          color: "var(--color-text-1)",
        }}
      >
        {priorityColor && (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: priorityColor }}
          />
        )}
        <span className="truncate">{task.title}</span>
      </div>
    );
  }

  // Week view — positioned chip
  const timeLabel = task.deadline
    ? format(new Date(task.deadline), "h:mm a")
    : null;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      aria-label={taskLabel}
      onClick={(e) => {
        e.stopPropagation();
        onEdit?.(task);
      }}
      onKeyDown={handleKeyDown}
      className={cn(
        "group absolute right-1 left-1 cursor-grab overflow-hidden rounded-md px-2 py-1 select-none active:cursor-grabbing",
        "shadow-sm transition-opacity",
        isBeingDragged ? "opacity-0" : "opacity-100",
      )}
      style={{
        ...draggableStyle,
        backgroundColor: `${categoryColor}30`,
        borderLeft: `3px solid ${categoryColor}`,
        border: `1px solid ${categoryColor}40`,
        borderLeftWidth: "3px",
      }}
    >
      <p className="text-meta truncate leading-tight font-semibold text-[var(--color-text-1)]">
        {task.title}
      </p>
      {timeLabel && (
        <p className="text-caption mt-0.5 leading-tight text-[var(--color-text-3)]">
          {timeLabel}
        </p>
      )}
      {/* Resize handle visual affordance */}
      <div className="absolute right-0 bottom-0 left-0 flex h-[6px] cursor-s-resize items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
        <div className="h-[2px] w-6 rounded-full bg-[rgba(255,255,255,0.3)]" />
      </div>
    </div>
  );
}

/** Ghost overlay shown during drag across the whole DndContext */
export function CalendarTaskChipOverlay({ task }: { task: Task }) {
  const userSettings = useAppStore((s) => s.userSettings);
  const categoryColor =
    userSettings?.do_category_colors?.[task.category] ||
    DEFAULT_DO_COLORS[task.category] ||
    "var(--color-text-3)";

  return (
    <div
      className="pointer-events-none scale-105 rotate-1 overflow-hidden rounded-md px-2 py-1 shadow-2xl"
      style={{
        backgroundColor: `${categoryColor}40`,
        borderLeft: `3px solid ${categoryColor}`,
        border: `1px solid ${categoryColor}60`,
        borderLeftWidth: "3px",
        width: 160,
        minHeight: 40,
      }}
    >
      <p className="text-meta truncate leading-tight font-semibold text-[var(--color-text-1)]">
        {task.title}
      </p>
    </div>
  );
}
