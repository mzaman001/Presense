"use client";
import { Input } from "../ui/Input";
import {
  insertNewTaskIntoCaches,
  readSubtasks,
  updateTaskInCaches,
  type TaskRecord,
} from "@/lib/task-cache";
import { useUserId } from "@/components/providers/SessionProvider";
import { Textarea } from "../ui/Textarea";
import { logger } from "@/lib/logger";
import React, { useState, useEffect, useRef } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { m, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { taskSchema } from "@/lib/schemas";
import { parseTaskText } from "@/lib/nlp/parse-task-text";
import { z } from "zod";
import {
  X,
  Calendar,
  Flag,
  Loader2,
  RotateCw,
  Tag,
  Timer,
  Clock,
  Trash2,
  Check,
  Plus,
} from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { Popover } from "@/components/ui/Popover";
import { toast } from "sonner";
import { createClient, safeMutate } from "@/lib/supabase";
import type { Database } from "@/types/database.types";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

/**
 * Panel repeat controls for an RRULE. INTERVAL is checked first: it used to
 * come after the WEEKLY check, so "every other week" reopened as plain
 * Weekly and lost its interval on save.
 */
function rruleToRepeatState(rrule: string | null) {
  const state = {
    freq: "Does not repeat",
    days: [] as string[],
    customRRule: "",
    customInterval: 1,
    customFreq: "WEEKLY",
  };
  if (!rrule) return state;
  if (rrule.includes("INTERVAL=")) {
    state.freq = "Custom";
    state.customRRule = rrule;
    const interval = rrule.match(/INTERVAL=(\d+)/);
    if (interval) state.customInterval = parseInt(interval[1]);
    const f = rrule.match(/FREQ=([A-Z]+)/);
    if (f) state.customFreq = f[1];
  } else if (rrule === "FREQ=DAILY") state.freq = "Daily";
  else if (rrule === "FREQ=MONTHLY") state.freq = "Monthly";
  else if (/^FREQ=WEEKLY(;BYDAY=[A-Z,]+)?$/.test(rrule)) {
    state.freq = "Weekly";
    const byDay = rrule.match(/BYDAY=([A-Z,]+)/);
    if (byDay) state.days = byDay[1].split(",");
  } else {
    state.freq = "Custom";
    state.customRRule = rrule;
    const f = rrule.match(/FREQ=([A-Z]+)/);
    if (f) state.customFreq = f[1];
  }
  return state;
}
import { DEFAULT_DO_COLORS } from "@/lib/constants";
import { useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/useAppStore";
import { cn, formatRRule } from "@/lib/utils";
import { formatMinutes } from "@/lib/format-minutes";
import { format } from "date-fns";
import { Sheet } from "@/components/ui/Sheet";
// INFRA-19: status writes on entity tables go through item-lifecycle.ts
import { moveItemToTrashPatch, newTaskInsert } from "@/lib/item-lifecycle";
import { Button } from "@/components/ui/button";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";

/**
 * The panel edits an `items` row. Callers pass the row straight through, so
 * this is the generated shape with the columns the form does not touch made
 * optional (creation flows build a partial).
 */
type TaskEditData = Partial<TaskRecord> & { id: string; title: string };

/**
 * The stored rows carry only { text, completed }; the form needs a stable
 * client-side id for list keys and reordering.
 */
function withSubtaskIds(
  subtasks: { text: string; completed: boolean }[],
): { id: string; text: string; completed: boolean }[] {
  return subtasks.map((subtask, index) => ({
    id: `${index}-${subtask.text}`,
    ...subtask,
  }));
}

type TaskFormValues = z.infer<typeof taskSchema>;

// BUG-42: plain-state fields not tracked by RHF's isDirty. Snapshot at open,
// compare at close, so close/beforeunload guards don't miss edits to them.
interface ManualSnapshot {
  subtasks: { id: string; text: string; completed: boolean }[];
  timeEstimate: number | null;
  freq: string;
  days: string[];
  customRRule: string;
  customInterval: number;
  customFreq: string;
  startDate: string;
}

const DEFAULT_DO_CATEGORIES = ["work", "study", "personal", "errand", "health"];

interface TaskAddPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskAdded?: () => void;
  taskToEdit?: TaskEditData | null;
  initialDeadline?: Date | null;
}

export function TaskAddPanel({
  isOpen,
  onClose,
  onTaskAdded,
  taskToEdit,
  initialDeadline,
}: TaskAddPanelProps) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const [parsedDeadline, setParsedDeadline] = useState<Date | null>(null);
  const [startDate, setStartDate] = useState("");
  const [parsedStartDate, setParsedStartDate] = useState<Date | null>(null);
  const [isManualDate, setIsManualDate] = useState(false);
  const [timeEstimate, setTimeEstimate] = useState<number | null>(null);
  const [subtasks, setSubtasks] = useState<
    { id: string; text: string; completed: boolean }[]
  >([]);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isValid, isDirty },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      category: "work",
      priority: null,
      deadline: "",
      notes: "",
      first_step: "",
    },
    mode: "onChange",
  });

  const titleValue = watch("title");
  const deadlineValue = watch("deadline");
  const categoryValue = watch("category");
  const priorityValue = watch("priority");
  const notesValue = watch("notes");
  const firstStepValue = watch("first_step");

  const [freq, setFreq] = useState("Does not repeat");
  const [days, setDays] = useState<string[]>([]);
  const [customRRule, setCustomRRule] = useState("");
  const [customInterval, setCustomInterval] = useState(1);
  const [customFreq, setCustomFreq] = useState("WEEKLY");
  // Once the user touches the repeat controls, typing stops overriding them.
  const [isManualRepeat, setIsManualRepeat] = useState(false);
  const applyRepeat = (rrule: string | null) => {
    const next = rruleToRepeatState(rrule);
    setFreq(next.freq);
    setDays(next.days);
    setCustomRRule(next.customRRule);
    setCustomInterval(next.customInterval);
    setCustomFreq(next.customFreq);
  };

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoriesList, setCategoriesList] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [deleteTaskConfirm, setDeleteTaskConfirm] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const manualBaselineRef = useRef<ManualSnapshot | null>(null);

  const manualSnapshot = (): ManualSnapshot => ({
    subtasks,
    timeEstimate,
    freq,
    days,
    customRRule,
    customInterval,
    customFreq,
    startDate,
  });

  const manualDirty = () =>
    manualBaselineRef.current !== null &&
    JSON.stringify(manualSnapshot()) !==
      JSON.stringify(manualBaselineRef.current);

  const dirty = isDirty || manualDirty();
  useUnsavedGuard(dirty);

  const handleClose = () => {
    if (dirty) {
      setShowUnsavedWarning(true);
    } else {
      onClose();
    }
  };

  const userSettings = useAppStore((s) => s.userSettings); // PERF-14

  useEffect(() => {
    if (isOpen) {
      setCategoriesList(userSettings?.do_categories || DEFAULT_DO_CATEGORIES);
    }
  }, [isOpen, userSettings?.do_categories]);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      setIsAddingCategory(false);
      return;
    }
    const name = newCategoryName.trim().toLowerCase();
    if (!categoriesList.includes(name)) {
      const newList = [...categoriesList, name];
      setCategoriesList(newList);
      setValue("category", name, { shouldValidate: true, shouldDirty: true });

      const supabase = createClient();
      if (userId) {
        // BUG-38: check error before committing the new category to state
        const { success } = await safeMutate(
          () =>
            supabase
              .from("user_settings")
              .update({ do_categories: newList })
              .eq("user_id", userId),
          "Failed to save category",
        );
        if (!success) {
          setCategoriesList(categoriesList);
          return;
        }
        const updatedSettings = { ...userSettings, do_categories: newList };
        useAppStore.getState().setUserSettings(updatedSettings);
      }
    } else {
      setValue("category", name, { shouldValidate: true, shouldDirty: true });
    }
    setNewCategoryName("");
    setIsAddingCategory(false);
  };

  const confirmDelete = async () => {
    if (!taskToEdit) return;

    // Save current caches for possible rollback
    const previousTasks = queryClient.getQueryData<TaskEditData[]>(["tasks"]);
    const previousDashboard = queryClient.getQueryData<{
      tasks: TaskEditData[];
    }>(["dashboard"]);

    // Optimistically remove from ["tasks"]
    queryClient.setQueryData<TaskEditData[]>(
      ["tasks"],
      (old) => old?.filter((t) => t.id !== taskToEdit.id) ?? [],
    );

    // Optimistically remove from ["dashboard"]
    queryClient.setQueryData<{ tasks: TaskEditData[] }>(
      ["dashboard"],
      (old) => {
        if (!old) return old;
        return {
          ...old,
          tasks: old.tasks?.filter((t) => t.id !== taskToEdit.id) ?? [],
        };
      },
    );

    try {
      useAppStore.getState().markMutation();
      const supabase = createClient();
      const { error } = await supabase
        .from("items")
        .update(moveItemToTrashPatch())
        .eq("id", taskToEdit.id);
      if (error) throw error;

      toast.success("Task moved to trash");
      if (onTaskAdded) onTaskAdded();
      onClose();
    } catch (err: unknown) {
      // Rollback on failure
      queryClient.setQueryData(["tasks"], previousTasks);
      queryClient.setQueryData(["dashboard"], previousDashboard);

      const message =
        err instanceof Error ? err.message : "Failed to move task to trash";
      toast.error("Failed to move task to trash", { description: message });
    } finally {
      setDeleteTaskConfirm(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (taskToEdit) {
        reset({
          title: taskToEdit.title || "",
          category: taskToEdit.category || "work",
          priority: taskToEdit.priority || null,
          notes: taskToEdit.notes || "",
          first_step: taskToEdit.first_step || "",
          deadline: taskToEdit.deadline
            ? format(new Date(taskToEdit.deadline), "yyyy-MM-dd'T'HH:mm")
            : "",
        });
        setIsManualDate(false);
        setTimeEstimate(taskToEdit.time_estimate || null);
        setSubtasks(withSubtaskIds(readSubtasks(taskToEdit.subtasks)));

        applyRepeat(taskToEdit.recurrence ?? null);
        // Editing the title of an existing task must not rewrite its repeat.
        setIsManualRepeat(true);

        if (taskToEdit.deadline) {
          const d = new Date(taskToEdit.deadline);
          setParsedDeadline(d);
        } else {
          setParsedDeadline(null);
        }

        let nextStartDate = "";
        if (taskToEdit.start_date) {
          const d = new Date(taskToEdit.start_date);
          setParsedStartDate(d);
          nextStartDate = format(d, "yyyy-MM-dd'T'HH:mm");
          setStartDate(nextStartDate);
        } else {
          setParsedStartDate(null);
          setStartDate("");
        }

        manualBaselineRef.current = {
          subtasks: withSubtaskIds(readSubtasks(taskToEdit.subtasks)),
          timeEstimate: taskToEdit.time_estimate || null,
          ...rruleToRepeatState(taskToEdit.recurrence ?? null),
          startDate: nextStartDate,
        };
      } else {
        reset({
          title: "",
          category: "work",
          priority: null,
          notes: "",
          first_step: "",
          deadline: initialDeadline
            ? format(initialDeadline, "yyyy-MM-dd'T'HH:mm")
            : "",
        });
        setParsedDeadline(initialDeadline ?? null);
        setStartDate("");
        setParsedStartDate(null);
        applyRepeat(null);
        setIsManualRepeat(false);
        setIsManualDate(false);
        setTimeEstimate(null);
        setSubtasks([]);
        manualBaselineRef.current = {
          subtasks: [],
          timeEstimate: null,
          freq: "Does not repeat",
          days: [],
          customRRule: "",
          customInterval: 1,
          customFreq: "WEEKLY",
          startDate: "",
        };
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, taskToEdit, initialDeadline]);

  const handleTitleChange = async (val: string) => {
    if (userSettings?.nlp_date_parsing === false) return;
    if (isManualDate && isManualRepeat) return;
    const parsed = await parseTaskText(val);
    if (!isManualDate) {
      if (parsed.deadline) {
        setParsedDeadline(parsed.deadline);
        setValue("deadline", format(parsed.deadline, "yyyy-MM-dd'T'HH:mm"), {
          shouldValidate: true,
          shouldDirty: true,
        });
      } else {
        setParsedDeadline(null);
        setValue("deadline", "", { shouldValidate: true, shouldDirty: true });
      }
    }
    if (!isManualRepeat) applyRepeat(parsed.recurrence);
  };

  const handleManualDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsManualDate(true);
    if (e.target.value) {
      setParsedDeadline(new Date(e.target.value));
      setValue("deadline", e.target.value, {
        shouldValidate: true,
        shouldDirty: true,
      });
    } else {
      setParsedDeadline(null);
      setValue("deadline", "", { shouldValidate: true, shouldDirty: true });
    }
  };

  const setQuickDate = (type: string) => {
    setIsManualDate(true);
    const d = new Date();
    if (type === "today") {
      d.setHours(23, 59, 0, 0);
    } else if (type === "tomorrow") {
      d.setDate(d.getDate() + 1);
      d.setHours(23, 59, 0, 0);
    } else if (type === "weekend") {
      const daysUntilSaturday = 6 - d.getDay();
      d.setDate(d.getDate() + (daysUntilSaturday >= 0 ? daysUntilSaturday : 6));
      d.setHours(23, 59, 0, 0);
    } else if (type === "next_week") {
      const daysUntilMonday = (8 - d.getDay()) % 7 || 7;
      d.setDate(d.getDate() + daysUntilMonday);
      d.setHours(9, 0, 0, 0);
    } else if (type === "none") {
      setParsedDeadline(null);
      setValue("deadline", "", { shouldValidate: true, shouldDirty: true });
      return;
    }
    setParsedDeadline(d);
    setValue("deadline", format(d, "yyyy-MM-dd'T'HH:mm"), {
      shouldValidate: true,
    });
  };

  const onSubmit = async (data: TaskFormValues) => {
    setSaving(true);

    try {
      const supabase = createClient();

      if (userId) {
        let finalRecurrence = null;
        if (freq === "Daily") finalRecurrence = "FREQ=DAILY";
        else if (freq === "Monthly") finalRecurrence = "FREQ=MONTHLY";
        else if (freq === "Weekly") {
          finalRecurrence = "FREQ=WEEKLY";
          if (days.length > 0) finalRecurrence += `;BYDAY=${days.join(",")}`;
        } else if (freq === "Custom") {
          if (customInterval > 1) {
            finalRecurrence = `FREQ=${customFreq};INTERVAL=${customInterval}`;
          } else {
            finalRecurrence = customRRule.trim() || null;
          }
        }

        let finalTitle = data.title.trim();
        const parsedFromText =
          userSettings?.nlp_date_parsing !== false &&
          ((parsedDeadline && !isManualDate) ||
            (!isManualRepeat && finalRecurrence));
        if (parsedFromText) {
          finalTitle = (
            await parseTaskText(finalTitle, { parseDates: !isManualDate })
          ).title;
          finalTitle = finalTitle.replace(
            /^(remind me to|remember to|need to|have to|must|gotta)\s+/i,
            "",
          );
          if (finalTitle.length > 0)
            finalTitle =
              finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
        }

        const payload: Database["public"]["Tables"]["items"]["Insert"] = {
          user_id: userId,
          title: finalTitle || data.title.trim(),
          first_step: data.first_step?.trim() || null,
          ifthen_trigger: null,
          deadline: parsedDeadline ? parsedDeadline.toISOString() : null,
          start_date: parsedStartDate ? parsedStartDate.toISOString() : null,
          recurrence: finalRecurrence,
          category: data.category || "work",
          priority: data.priority ?? 4,
          time_estimate: timeEstimate,
          notes: data.notes?.trim() || null,
          subtasks: subtasks.filter((st) => st.text.trim() !== ""),
        };

        // INFRA-19: the status field on a new task is owned by the
        // lifecycle module — hand-write never happens.
        const insertPayload = taskToEdit ? payload : newTaskInsert(payload);

        if (taskToEdit && taskToEdit.deadline !== payload.deadline) {
          payload.notification_sent_72h = false;
          payload.notification_sent_24h = false;
          payload.notification_sent_6h = false;
          payload.notification_sent_1h = false;
          payload.notification_sent_overdue = false;
        }

        // Show the result straight away and save in the background. The
        // list used to wait for the insert and then a full refetch (two
        // round trips to the database) before the task appeared.
        const id = taskToEdit?.id ?? crypto.randomUUID();
        const isEdit = Boolean(taskToEdit);
        const save = async () => {
          const nowIso = new Date().toISOString();
          const rollback = isEdit
            ? updateTaskInCaches(
                queryClient,
                id,
                payload as Partial<TaskRecord>,
              )
            : insertNewTaskIntoCaches(queryClient, {
                ...insertPayload,
                id,
                created_at: nowIso,
                updated_at: nowIso,
              } as unknown as TaskRecord);

          useAppStore.getState().markMutation();
          const { error } = isEdit
            ? await supabase.from("items").update(payload).eq("id", id)
            : await supabase.from("items").insert({ ...insertPayload, id });

          if (error) {
            rollback();
            logger.error("Save error:", error);
            // The panel is already closed, so the toast carries the retry.
            toast.error(
              isEdit
                ? `Couldn't save changes to “${payload.title}”`
                : `Couldn't add “${payload.title}”`,
              {
                description: error.message,
                action: { label: "Retry", onClick: () => void save() },
              },
            );
            return;
          }

          toast.success(isEdit ? "Task updated" : "Task added");
          // Reconcile with the server's copy (defaults, triggers, ordering).
          if (onTaskAdded) onTaskAdded();
        };

        // save() updates the caches synchronously before its first await,
        // so the task is on screen by the time the panel closes.
        const pending = save();
        onClose();
        await pending;
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Could not save task";
      toast.error("Unexpected error", { description: message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Sheet
        isOpen={isOpen}
        onClose={handleClose}
        title={taskToEdit ? "Edit task" : "New task"}
        footer={
          <div className="flex items-center gap-2">
            {taskToEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Move task to trash"
                onClick={() => setDeleteTaskConfirm(true)}
                className="text-[var(--text-3)] hover:bg-[var(--status-danger-dim)] hover:text-[var(--status-danger)]"
              >
                <Trash2 aria-hidden="true" className="size-[18px]" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              className="ml-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="task-form"
              variant="primary"
              disabled={isSubmitting || !isValid}
              className="min-w-28"
            >
              {isSubmitting ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : taskToEdit ? (
                "Save changes"
              ) : (
                "Add task"
              )}
            </Button>
          </div>
        }
      >
        <form
          id="task-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col"
        >
          <div className="space-y-6 pt-1">
            {/* Compose: title and notes share one surface, the way
                Things and Todoist open a task — what it is, then context. */}
            <div className="task-compose">
              <Input
                aria-label="Task name"
                autoFocus
                data-autofocus="true"
                inputMode="text"
                autoCapitalize="sentences"
                placeholder="What needs to be done?"
                variant="title"
                className="task-compose-title"
                {...register("title", {
                  onChange: (e) => handleTitleChange(e.target.value),
                })}
                error={errors.title?.message}
                aria-invalid={!!errors.title}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit(onSubmit)();
                  }
                }}
              />
              <label className="sr-only" htmlFor="task-notes">
                Notes
              </label>
              <TextareaAutosize
                data-testid="autosize-textarea"
                id="task-notes"
                placeholder="Add notes"
                {...register("notes")}
                minRows={1}
                className={cn(
                  "task-compose-notes resize-none",
                  errors.notes && "!border-[var(--status-danger)]",
                )}
                aria-invalid={!!errors.notes}
                aria-describedby={errors.notes ? `notes-error` : undefined}
              />
              {errors.notes && (
                <p
                  id="notes-error"
                  className="text-caption mt-1 text-[var(--status-danger)]"
                >
                  {errors.notes.message}
                </p>
              )}
            </div>

            {/* Properties: one labelled row each, Linear-style, so the
                panel reads top to bottom instead of as a wall of chips. */}
            <div className="task-props" role="group" aria-label="Details">
              <div className="task-prop">
                <span className="task-prop-label">
                  <Calendar aria-hidden="true" className="size-4" />
                  When
                </span>
                <div className="flex flex-wrap gap-2">
                  <Popover
                    trigger={
                      <button
                        type="button"
                        aria-pressed={Boolean(deadlineValue)}
                        className="chip"
                      >
                        <Calendar aria-hidden="true" className="size-4" />
                        {deadlineValue
                          ? (() => {
                              const d = new Date(deadlineValue);
                              const hasTime =
                                d.getHours() !== 0 || d.getMinutes() !== 0;
                              const dateStr = d.toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              });
                              const timeStr = hasTime
                                ? ` ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
                                : "";
                              return `${dateStr}${timeStr}`;
                            })()
                          : "Due date"}
                      </button>
                    }
                    content={
                      <div className="w-[min(340px,calc(100vw-32px))] space-y-4 p-3">
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { id: "today", label: "Today" },
                            { id: "tomorrow", label: "Tomorrow" },
                            { id: "weekend", label: "This weekend" },
                            { id: "next_week", label: "Next week" },
                            { id: "none", label: "No date" },
                          ].map((btn) => (
                            <button
                              key={btn.id}
                              type="button"
                              onClick={() => setQuickDate(btn.id)}
                              className="chip chip-sm"
                            >
                              {btn.label}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="field-label">Due</label>
                            <input
                              type="datetime-local"
                              className={cn(
                                "input !px-2.5 !py-2 !text-[length:var(--text-ui)]",
                                errors.deadline &&
                                  "!border-[var(--status-danger)]",
                              )}
                              {...register("deadline", {
                                onChange: handleManualDateChange,
                              })}
                              aria-invalid={!!errors.deadline}
                              aria-describedby={
                                errors.deadline ? `deadline-error` : undefined
                              }
                            />
                            {errors.deadline && (
                              <p
                                id="deadline-error"
                                className="text-caption mt-1 text-[var(--status-danger)]"
                              >
                                {errors.deadline.message}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className="field-label">Start</label>
                            <input
                              type="datetime-local"
                              value={startDate || ""}
                              onChange={(e) => {
                                setStartDate(e.target.value);
                                setParsedStartDate(
                                  e.target.value
                                    ? new Date(e.target.value)
                                    : null,
                                );
                              }}
                              className="input !px-2.5 !py-2 !text-[length:var(--text-ui)]"
                            />
                          </div>
                        </div>
                      </div>
                    }
                  />
                  <Popover
                    trigger={
                      <button
                        type="button"
                        aria-pressed={freq !== "Does not repeat"}
                        className="chip"
                      >
                        <RotateCw aria-hidden="true" className="size-4" />
                        {freq !== "Does not repeat" ? freq : "Repeat"}
                      </button>
                    }
                    content={
                      <div className="w-[min(320px,calc(100vw-32px))] p-3">
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {[
                            "Does not repeat",
                            "Daily",
                            "Weekly",
                            "Monthly",
                            "Custom",
                          ].map((f) => (
                            <button
                              key={f}
                              type="button"
                              onClick={() => {
                                setIsManualRepeat(true);
                                setFreq(f);
                              }}
                              aria-pressed={freq === f}
                              className="chip chip-sm"
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                        {freq === "Weekly" && (
                          <div className="flex flex-wrap gap-1">
                            {[
                              { l: "Mo", v: "MO" },
                              { l: "Tu", v: "TU" },
                              { l: "We", v: "WE" },
                              { l: "Th", v: "TH" },
                              { l: "Fr", v: "FR" },
                              { l: "Sa", v: "SA" },
                              { l: "Su", v: "SU" },
                            ].map((d) => (
                              <button
                                key={d.v}
                                type="button"
                                onClick={() => {
                                  setIsManualRepeat(true);
                                  setDays((prev) =>
                                    prev.includes(d.v)
                                      ? prev.filter((x) => x !== d.v)
                                      : [...prev, d.v],
                                  );
                                }}
                                aria-pressed={days.includes(d.v)}
                                className="chip chip-sm !min-w-10 justify-center !px-0"
                              >
                                {d.l}
                              </button>
                            ))}
                          </div>
                        )}
                        {freq === "Custom" && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-[length:var(--text-ui)] text-[var(--text-3)]">
                              Every
                            </span>
                            <input
                              type="number"
                              min="1"
                              value={customInterval}
                              onChange={(e) => {
                                setIsManualRepeat(true);
                                setCustomInterval(
                                  Math.max(1, parseInt(e.target.value) || 1),
                                );
                              }}
                              aria-label="Repeat interval"
                              className="input !w-16 !px-2 !py-2 !text-center !text-[length:var(--text-ui)]"
                            />
                            <Dropdown
                              variant="select"
                              value={customFreq}
                              onChange={(value) => {
                                setIsManualRepeat(true);
                                setCustomFreq(value);
                              }}
                              options={[
                                { value: "DAILY", label: "Days" },
                                { value: "WEEKLY", label: "Weeks" },
                                { value: "MONTHLY", label: "Months" },
                                { value: "YEARLY", label: "Years" },
                              ]}
                              aria-label="Repeat unit"
                              className="!w-32"
                            />
                          </div>
                        )}
                        {freq === "Custom" &&
                          customRRule &&
                          customInterval === 1 && (
                            // A parsed rule like "on the 1st" has no control
                            // of its own; say what will repeat.
                            <p className="mt-2 text-[length:var(--text-meta)] text-[var(--text-3)]">
                              {formatRRule(customRRule)}
                            </p>
                          )}
                      </div>
                    }
                  />
                </div>
              </div>
              <div className="task-prop">
                <span className="task-prop-label">
                  <Flag aria-hidden="true" className="size-4" />
                  Priority
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    {
                      val: 1,
                      label: "Urgent",
                      colorClass:
                        "bg-transparent text-[var(--status-danger)] border-[var(--status-danger-border)] hover:bg-[var(--status-danger-dim)]",
                      activeClass:
                        "bg-[var(--status-danger-dim)] text-[var(--status-danger)] border-[var(--status-danger)]",
                    },
                    {
                      val: 2,
                      label: "High",
                      colorClass:
                        "bg-transparent text-[var(--status-today)] border-[var(--status-today-border)] hover:bg-[var(--status-today-dim)]",
                      activeClass:
                        "bg-[var(--status-today-dim)] text-[var(--status-today)] border-[var(--status-today)]",
                    },
                    {
                      val: 3,
                      label: "Medium",
                      colorClass:
                        "bg-transparent text-[var(--status-upcoming)] border-[var(--status-upcoming-border)] hover:bg-[var(--status-upcoming-dim)]",
                      activeClass:
                        "bg-[var(--status-upcoming-dim)] text-[var(--status-upcoming)] border-[var(--status-upcoming)]",
                    },
                    {
                      val: 4,
                      label: "Low",
                      colorClass:
                        "bg-transparent text-[var(--text-3)] border-[var(--border-default)] hover:bg-[var(--surface-hover)]",
                      activeClass:
                        "bg-[var(--surface-active)] text-[var(--text-1)] border-[var(--border-strong)]",
                    },
                  ].map((p) => (
                    <m.button
                      key={p.val}
                      type="button"
                      whileTap={{ scale: 0.92 }}
                      onClick={() =>
                        setValue(
                          "priority",
                          priorityValue === p.val ? null : p.val,
                          { shouldValidate: true, shouldDirty: true },
                        )
                      }
                      aria-pressed={priorityValue === p.val}
                      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-[length:var(--text-ui)] font-medium transition-colors ${priorityValue === p.val ? p.activeClass : p.colorClass}`}
                    >
                      <span
                        aria-hidden="true"
                        className="size-2 rounded-full bg-current"
                      />
                      {p.label}
                    </m.button>
                  ))}
                </div>
              </div>
              <div className="task-prop">
                <span className="task-prop-label">
                  <Tag aria-hidden="true" className="size-4" />
                  Category
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {categoriesList.map((cat: string) => {
                    const cColor =
                      DEFAULT_DO_COLORS[cat] || "var(--color-text-3)";
                    const isActive = categoryValue === cat;
                    return (
                      <m.button
                        key={cat}
                        whileTap={{ scale: 0.92 }}
                        type="button"
                        onClick={() =>
                          setValue("category", isActive ? "" : cat, {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                        style={{
                          borderColor: isActive ? cColor : `${cColor}40`,
                          backgroundColor: isActive
                            ? `${cColor}20`
                            : "transparent",
                          color: isActive ? cColor : "var(--color-text-3)",
                        }}
                        aria-pressed={isActive}
                        className={`inline-flex min-h-8 items-center rounded-full border px-3 text-[length:var(--text-ui)] capitalize transition-colors ${
                          isActive
                            ? "font-medium"
                            : "hover:bg-[var(--surface-hover)]"
                        }`}
                      >
                        {cat}
                      </m.button>
                    );
                  })}
                  {isAddingCategory ? (
                    <input
                      autoFocus
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddCategory();
                        if (e.key === "Escape") setIsAddingCategory(false);
                      }}
                      onBlur={handleAddCategory}
                      placeholder="Type & enter..."
                      aria-label="New category name"
                      className="input !h-8 !w-36 !rounded-full !px-3 !py-0 !text-[length:var(--text-ui)]"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsAddingCategory(true)}
                      className="chip chip-sm border-dashed"
                    >
                      <Plus aria-hidden="true" className="size-3.5" /> New
                    </button>
                  )}
                </div>
              </div>
              <div className="task-prop">
                <span className="task-prop-label">
                  <Timer aria-hidden="true" className="size-4" />
                  Estimate
                </span>
                <div className="relative w-32">
                  <input
                    type="number"
                    placeholder="30"
                    aria-label="Estimate in minutes"
                    value={timeEstimate === null ? "" : timeEstimate}
                    onChange={(e) =>
                      setTimeEstimate(
                        e.target.value ? parseInt(e.target.value) : null,
                      )
                    }
                    className="input !h-8 !py-0 !pr-12 !text-[length:var(--text-ui)]"
                    min={1}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[length:var(--text-ui)] text-[var(--text-3)]">
                    min
                  </span>
                </div>
              </div>
              {/* Focus-timer minutes add up here (session_logs trigger). */}
              {taskToEdit?.time_spent_minutes ? (
                <div className="task-prop">
                  <span className="task-prop-label">
                    <Clock aria-hidden="true" className="size-4" />
                    Time spent
                  </span>
                  <span className="text-[length:var(--text-ui)] text-[var(--text-2)] tabular-nums">
                    {formatMinutes(taskToEdit.time_spent_minutes)} focused
                  </span>
                </div>
              ) : null}
            </div>

            {/* Getting it done: the first move, then the checklist. */}
            <div>
              <label className="field-label" htmlFor="task-first-step">
                First step
              </label>
              <input
                id="task-first-step"
                placeholder="What's the smallest action to start this?"
                className={cn(
                  "input",
                  errors.first_step && "!border-[var(--status-danger)]",
                )}
                {...register("first_step")}
                aria-invalid={!!errors.first_step}
                aria-describedby={
                  errors.first_step ? `first_step-error` : undefined
                }
              />
              {errors.first_step && (
                <p
                  id="first_step-error"
                  className="text-caption mt-1 text-[var(--status-danger)]"
                >
                  {errors.first_step.message}
                </p>
              )}
            </div>

            <div>
              <p className="field-label">Subtasks</p>
              <div className="space-y-0.5">
                {subtasks.map((st, i) => (
                  <div
                    key={st.id || i}
                    className="group flex items-center gap-1"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSubtasks(
                          subtasks.map((st, idx) =>
                            idx === i
                              ? { ...st, completed: !st.completed }
                              : st,
                          ),
                        );
                      }}
                      role="checkbox"
                      aria-checked={st.completed}
                      aria-label={st.text ? `Done: ${st.text}` : "Subtask done"}
                      className="-ml-2 flex size-9 shrink-0 items-center justify-center"
                    >
                      <span
                        className={cn(
                          "flex size-[18px] items-center justify-center rounded-full border-[1.5px] transition-colors",
                          st.completed
                            ? "border-[var(--accent)] bg-[var(--accent)]"
                            : "border-[var(--border-strong)] hover:border-[var(--accent)]",
                        )}
                      >
                        {st.completed && (
                          <Check
                            aria-hidden="true"
                            strokeWidth={3}
                            className="size-3 text-[var(--text-on-accent)]"
                          />
                        )}
                      </span>
                    </button>
                    <input
                      value={st.text}
                      onChange={(e) => {
                        setSubtasks(
                          subtasks.map((st, idx) =>
                            idx === i ? { ...st, text: e.target.value } : st,
                          ),
                        );
                      }}
                      placeholder="Subtask"
                      aria-label="Subtask"
                      className={cn(
                        "min-h-9 flex-1 border-none bg-transparent text-[length:var(--text-body-lg)] text-[var(--text-1)] placeholder:text-[var(--text-muted)] focus:outline-none",
                        st.completed && "text-[var(--text-muted)] line-through",
                      )}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setSubtasks(subtasks.filter((_, idx) => idx !== i))
                      }
                      aria-label="Remove subtask"
                      className="row-actions flex size-9 items-center justify-center rounded-lg text-[var(--text-3)] transition-colors hover:bg-[var(--status-danger-dim)] hover:text-[var(--status-danger)]"
                    >
                      <X aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setSubtasks([
                      ...subtasks,
                      { id: Date.now().toString(), text: "", completed: false },
                    ])
                  }
                  className="-ml-2 flex min-h-9 items-center gap-2 rounded-lg pr-3 pl-2 text-[length:var(--text-body)] text-[var(--text-3)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
                >
                  <Plus aria-hidden="true" className="size-4" /> Add subtask
                </button>
              </div>
            </div>
          </div>
        </form>
      </Sheet>
      <ConfirmModal
        isOpen={deleteTaskConfirm}
        onClose={() => setDeleteTaskConfirm(false)}
        onConfirm={confirmDelete}
        title="Move task to trash?"
        description="This task will leave active views and can be restored from Trash."
        confirmLabel="Move to trash"
        confirmDestructive
      />
      <ConfirmModal
        isOpen={showUnsavedWarning}
        onClose={() => setShowUnsavedWarning(false)}
        onConfirm={() => {
          setShowUnsavedWarning(false);
          onClose();
        }}
        title="Discard changes?"
        description="Your edits to this task haven't been saved."
        confirmLabel="Discard"
        confirmDestructive={false}
      />
    </>
  );
}
