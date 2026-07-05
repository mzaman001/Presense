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
  const { attributes, listeners, setNodeRef, transform, isDragging: localDragging } = useDraggable({
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

  if (variant === "month") {
    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={(e) => {
          e.stopPropagation();
          onEdit?.(task);
        }}
        className={cn(
          "flex items-center gap-1 px-1.5 py-0.5 rounded text-caption font-medium cursor-grab active:cursor-grabbing truncate w-full select-none",
          "transition-opacity",
          isBeingDragged ? "opacity-30" : "opacity-100"
        )}
        style={{
          ...draggableStyle,
          backgroundColor: `${categoryColor}22`,
          borderLeft: `2px solid ${categoryColor}`,
        }}
      >
        {priorityColor && (
          <span
            className="w-1 h-1 rounded-full shrink-0"
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
        onClick={(e) => {
          e.stopPropagation();
          onEdit?.(task);
        }}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium cursor-grab active:cursor-grabbing truncate select-none",
          "transition-opacity",
          isBeingDragged ? "opacity-30" : "opacity-100"
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
            className="w-1.5 h-1.5 rounded-full shrink-0"
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
      onClick={(e) => {
        e.stopPropagation();
        onEdit?.(task);
      }}
      className={cn(
        "absolute left-1 right-1 rounded-md px-2 py-1 cursor-grab active:cursor-grabbing overflow-hidden select-none group",
        "transition-opacity shadow-sm",
        isBeingDragged ? "opacity-0" : "opacity-100"
      )}
      style={{
        ...draggableStyle,
        backgroundColor: `${categoryColor}30`,
        borderLeft: `3px solid ${categoryColor}`,
        border: `1px solid ${categoryColor}40`,
        borderLeftWidth: "3px",
      }}
    >
      <p className="text-meta font-semibold text-[var(--color-text-1)] leading-tight truncate">
        {task.title}
      </p>
      {timeLabel && (
        <p className="text-caption text-[var(--color-text-3)] leading-tight mt-0.5">
          {timeLabel}
        </p>
      )}
      {/* Resize handle visual affordance */}
      <div className="absolute bottom-0 left-0 right-0 h-[6px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-s-resize">
        <div className="w-6 h-[2px] rounded-full bg-[rgba(255,255,255,0.3)]" />
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
      className="rounded-md px-2 py-1 overflow-hidden shadow-2xl pointer-events-none rotate-1 scale-105"
      style={{
        backgroundColor: `${categoryColor}40`,
        borderLeft: `3px solid ${categoryColor}`,
        border: `1px solid ${categoryColor}60`,
        borderLeftWidth: "3px",
        width: 160,
        minHeight: 40,
      }}
    >
      <p className="text-meta font-semibold text-[var(--color-text-1)] leading-tight truncate">
        {task.title}
      </p>
    </div>
  );
}
