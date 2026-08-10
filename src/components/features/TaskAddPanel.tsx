"use client";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { logger } from "@/lib/logger";
import React, { useState, useEffect, useRef } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { m, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { taskSchema } from "@/lib/schemas";
import { z } from "zod";
import { X, Calendar, Loader2, RotateCw, Trash2, Check } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { Popover } from "@/components/ui/Popover";
import { Avatar } from "@/components/ui/Avatar";
import { toast } from "sonner";
import { createClient, safeMutate } from "@/lib/supabase";
import type { Database } from "@/types/database.types";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

let chronoCache: typeof import("chrono-node") | null = null;
async function getChrono(): Promise<typeof import("chrono-node")> {
  if (!chronoCache) {
    const chrono = await import("chrono-node");
    const { registerCustomParsers } = await import("@/lib/chrono-custom");
    registerCustomParsers(chrono);
    chronoCache = chrono;
  }
  return chronoCache;
}
import { DEFAULT_DO_COLORS } from "@/lib/constants";
import { useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Sheet } from "@/components/ui/Sheet";
import { moveItemToTrashPatch } from "@/lib/item-lifecycle";
import { Button } from "@/components/ui/button";
import { Icon as UiIcon } from "@/components/ui/Icon";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";

interface TaskEditData {
  id: string;
  title: string;
  deadline?: string | null;
  start_date?: string | null;
  category?: string | null;
  priority?: number | null;
  notes?: string;
  first_step?: string | null;
  subtasks?: { id: string; text: string; completed: boolean }[];
  recurrence?: string | null;
  linked_people_ids?: string[] | null;
  time_estimate?: number | null;
}

type TaskFormValues = z.infer<typeof taskSchema>;

// BUG-42: plain-state fields not tracked by RHF's isDirty. Snapshot at open,
// compare at close, so close/beforeunload guards don't miss edits to them.
interface ManualSnapshot {
  subtasks: { id: string; text: string; completed: boolean }[];
  timeEstimate: number | null;
  linkedPeopleIds: string[];
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
  const queryClient = useQueryClient();
  const [parsedDeadline, setParsedDeadline] = useState<Date | null>(null);
  const [startDate, setStartDate] = useState("");
  const [parsedStartDate, setParsedStartDate] = useState<Date | null>(null);
  const [isManualDate, setIsManualDate] = useState(false);
  const [timeEstimate, setTimeEstimate] = useState<number | null>(null);
  const [subtasks, setSubtasks] = useState<
    { id: string; text: string; completed: boolean }[]
  >([]);
  const [linkedPeopleIds, setLinkedPeopleIds] = useState<string[]>([]);
  const [peopleList, setPeopleList] = useState<
    { id: string; name: string; initials: string; color: string }[]
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
    linkedPeopleIds,
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

  const { userSettings } = useAppStore();

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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // BUG-38: check error before committing the new category to state
        const { success } = await safeMutate(
          () =>
            supabase
              .from("user_settings")
              .update({ do_categories: newList })
              .eq("user_id", user.id),
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
    async function fetchPeople() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data } = await supabase
        .from("people")
        .select("id, name, initials, color")
        .eq("user_id", userData.user.id)
        .order("name");
      if (data)
        setPeopleList(
          data.map((p) => ({
            id: p.id,
            name: p.name,
            initials: p.initials ?? "",
            color: p.color ?? "",
          })),
        );
    }
    if (isOpen) {
      fetchPeople();
    }
  }, [isOpen]);

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
        setSubtasks(taskToEdit.subtasks || []);
        setLinkedPeopleIds(taskToEdit.linked_people_ids || []);

        let nextFreq = "Does not repeat";
        let nextDays: string[] = [];
        let nextCustomRRule = "";
        let nextCustomInterval = 1;
        let nextCustomFreq = "WEEKLY";
        if (taskToEdit.recurrence) {
          if (taskToEdit.recurrence === "FREQ=DAILY") nextFreq = "Daily";
          else if (taskToEdit.recurrence === "FREQ=MONTHLY")
            nextFreq = "Monthly";
          else if (taskToEdit.recurrence.includes("FREQ=WEEKLY")) {
            nextFreq = "Weekly";
            const match = taskToEdit.recurrence.match(/BYDAY=([A-Z,]+)/);
            if (match) nextDays = match[1].split(",");
          } else if (taskToEdit.recurrence.includes("INTERVAL=")) {
            nextFreq = "Custom";
            nextCustomRRule = taskToEdit.recurrence;
            const matchInterval = taskToEdit.recurrence.match(/INTERVAL=(\d+)/);
            if (matchInterval) nextCustomInterval = parseInt(matchInterval[1]);
            const matchFreq = taskToEdit.recurrence.match(/FREQ=([A-Z]+)/);
            if (matchFreq) nextCustomFreq = matchFreq[1];
          } else {
            nextFreq = "Custom";
            nextCustomRRule = taskToEdit.recurrence;
          }
        }
        setFreq(nextFreq);
        setDays(nextDays);
        setCustomRRule(nextCustomRRule);
        setCustomInterval(nextCustomInterval);
        setCustomFreq(nextCustomFreq);

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
          subtasks: taskToEdit.subtasks || [],
          timeEstimate: taskToEdit.time_estimate || null,
          linkedPeopleIds: taskToEdit.linked_people_ids || [],
          freq: nextFreq,
          days: nextDays,
          customRRule: nextCustomRRule,
          customInterval: nextCustomInterval,
          customFreq: nextCustomFreq,
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
        setFreq("Does not repeat");
        setDays([]);
        setCustomRRule("");
        setIsManualDate(false);
        setTimeEstimate(null);
        setSubtasks([]);
        setLinkedPeopleIds([]);
        manualBaselineRef.current = {
          subtasks: [],
          timeEstimate: null,
          linkedPeopleIds: [],
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
    if (!isManualDate && userSettings?.nlp_date_parsing !== false) {
      const chrono = await getChrono();
      const parsedResults = chrono.parse(val);
      if (parsedResults && parsedResults.length > 0) {
        let d: Date;
        if (parsedResults.length === 1) {
          d = parsedResults[0].start.date();
        } else {
          // Multiple results: combine their text and re-parse to merge date+time
          // e.g. "tomorrow" + "at 9pm" → "tomorrow at 9pm" → single correct result
          const combined = parsedResults.map((r) => r.text).join(" ");
          const merged = chrono.parse(combined);
          d =
            merged.length > 0 && merged[0].start
              ? merged[0].start.date()
              : parsedResults
                  .reduce((a, b) => (a.start.date() > b.start.date() ? a : b))
                  .start.date();
        }
        setParsedDeadline(d);
        setValue("deadline", format(d, "yyyy-MM-dd'T'HH:mm"), {
          shouldValidate: true,
          shouldDirty: true,
        });
      } else {
        setParsedDeadline(null);
        setValue("deadline", "", { shouldValidate: true, shouldDirty: true });
      }
    }
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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
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
        if (parsedDeadline && !isManualDate) {
          const chrono = await getChrono();
          const parsedResults = chrono.parse(finalTitle);
          if (parsedResults && parsedResults.length > 0) {
            parsedResults.forEach((r) => {
              finalTitle = finalTitle.replace(r.text, "");
            });
            finalTitle = finalTitle.replace(/\s+/g, " ").trim();
            finalTitle = finalTitle.replace(
              /^(remind me to|remember to|need to|have to|must|gotta)\s+/i,
              "",
            );
            if (finalTitle.length > 0)
              finalTitle =
                finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
          }
        }

        const payload: Database["public"]["Tables"]["items"]["Insert"] = {
          user_id: user.id,
          title: finalTitle || data.title.trim(),
          first_step: data.first_step?.trim() || null,
          ifthen_trigger: null,
          deadline: parsedDeadline ? parsedDeadline.toISOString() : null,
          start_date: parsedStartDate ? parsedStartDate.toISOString() : null,
          recurrence: finalRecurrence,
          category: data.category || "work",
          status: "active",
          priority: data.priority ?? 4,
          time_estimate: timeEstimate,
          notes: data.notes?.trim() || null,
          subtasks: subtasks.filter((st) => st.text.trim() !== ""),
          linked_people_ids: linkedPeopleIds,
        };

        if (taskToEdit && taskToEdit.deadline !== payload.deadline) {
          payload.notification_sent_72h = false;
          payload.notification_sent_24h = false;
          payload.notification_sent_6h = false;
          payload.notification_sent_1h = false;
          payload.notification_sent_overdue = false;
        }

        let error;
        useAppStore.getState().markMutation();
        if (taskToEdit) {
          const res = await supabase
            .from("items")
            .update(payload)
            .eq("id", taskToEdit.id);
          error = res.error;
        } else {
          const res = await supabase.from("items").insert(payload);
          error = res.error;
        }

        if (error) {
          logger.error("Save error:", error);
          toast.error(`Failed to ${taskToEdit ? "update" : "save"} task`, {
            description: error.message,
          });
          setSaving(false);
          return;
        }

        toast.success(`Task ${taskToEdit ? "updated" : "saved"} successfully`);
        if (onTaskAdded) onTaskAdded();
        onClose();
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
        title={taskToEdit ? "Edit Task" : "Add Task"}
      >
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex h-full flex-col"
        >
          <div
            className="flex-1 space-y-6 overflow-y-auto p-6"
            data-lenis-prevent
          >
            {/* Title */}
            <Input
              label={
                <>
                  Task Name <span className="text-red-400">*</span>
                </>
              }
              autoFocus
              data-autofocus="true"
              inputMode="text"
              autoCapitalize="sentences"
              placeholder="What needs to be done?"
              variant="title"
              {...register("title", {
                onChange: (e) => handleTitleChange(e.target.value),
              })}
              error={errors.title?.message}
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? `title-error` : undefined}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit(onSubmit)();
                }
              }}
            />

            {/* Subtasks */}
            <div>
              <label className="text-label mb-2 block text-[var(--text-3)]">
                Subtasks
              </label>
              <div className="space-y-1.5">
                {subtasks.map((st, i) => (
                  <div
                    key={st.id || i}
                    className="group flex items-center gap-2"
                  >
                    <button
                      onClick={() => {
                        setSubtasks(
                          subtasks.map((st, idx) =>
                            idx === i
                              ? { ...st, completed: !st.completed }
                              : st,
                          ),
                        );
                      }}
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                        st.completed
                          ? "border-[var(--color-text-3)] bg-[var(--color-text-3)]"
                          : "border-[var(--color-border)] hover:border-[var(--color-text-3)]",
                      )}
                    >
                      {st.completed && (
                        <UiIcon
                          className="h-3 w-3 text-[var(--color-background)]"
                          icon={Check}
                        />
                      )}
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
                      placeholder="Subtask..."
                      className={cn(
                        "flex-1 border-none bg-transparent text-sm placeholder:text-[var(--text-muted)] focus:outline-none",
                        st.completed && "text-[var(--text-muted)] line-through",
                      )}
                    />
                    <button
                      onClick={() =>
                        setSubtasks(subtasks.filter((_, idx) => idx !== i))
                      }
                      className="p-1 text-[var(--text-muted)] opacity-0 transition-all group-hover:opacity-100 hover:text-[#F87171]"
                    >
                      <UiIcon size={14} icon={X} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setSubtasks([
                      ...subtasks,
                      { id: Date.now().toString(), text: "", completed: false },
                    ])
                  }
                  className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-3)] transition-colors hover:text-[var(--text-1)]"
                >
                  <span className="text-lg leading-none font-light">+</span> Add
                  subtask
                </button>
              </div>
            </div>

            {/* First Step */}
            <div>
              <label className="text-label mb-2 block text-[var(--text-3)]">
                First Step{" "}
                <span className="text-[var(--text-muted)]">(optional)</span>
              </label>
              <input
                placeholder="What's the smallest action to start this?"
                className={cn("input", errors.first_step && "!border-red-500")}
                {...register("first_step")}
                aria-invalid={!!errors.first_step}
                aria-describedby={
                  errors.first_step ? `first_step-error` : undefined
                }
              />
              {errors.first_step && (
                <p
                  id="first_step-error"
                  className="text-caption mt-1 text-red-500"
                >
                  {errors.first_step.message}
                </p>
              )}
            </div>

            {/* Action Toolbar (Date & Repeat) */}
            <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-2">
              <Popover
                trigger={
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                      deadlineValue
                        ? "border-[var(--color-text-1)] bg-[var(--color-text-1)] text-[var(--color-background)]"
                        : "border-[var(--color-border)] bg-transparent text-[var(--text-3)] hover:bg-[var(--color-surface)]",
                    )}
                  >
                    <UiIcon size={13} icon={Calendar} />
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
                      : "Due Date"}
                  </button>
                }
                content={
                  <div className="w-[280px] space-y-4 p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: "today", label: "Today" },
                        { id: "tomorrow", label: "Tomorrow" },
                        { id: "weekend", label: "This Weekend" },
                        { id: "next_week", label: "Next Week" },
                        { id: "none", label: "No Date" },
                      ].map((btn) => (
                        <button
                          key={btn.id}
                          onClick={() => setQuickDate(btn.id)}
                          className="text-meta rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--color-border)]"
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-caption mb-1.5 block font-bold tracking-widest text-[var(--text-muted)] uppercase">
                          Due Date/Time
                        </label>
                        <input
                          type="datetime-local"
                          className={cn(
                            "input !px-2 !py-1.5 !text-xs",
                            errors.deadline && "!border-red-500",
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
                            className="text-caption mt-1 text-red-500"
                          >
                            {errors.deadline.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="text-caption mb-1.5 block font-bold tracking-widest text-[var(--text-muted)] uppercase">
                          Start Date
                        </label>
                        <input
                          type="datetime-local"
                          value={startDate || ""}
                          onChange={(e) => {
                            setStartDate(e.target.value);
                            setParsedStartDate(
                              e.target.value ? new Date(e.target.value) : null,
                            );
                          }}
                          className="input !px-2 !py-1.5 !text-xs"
                        />
                      </div>
                    </div>
                  </div>
                }
              />

              <Popover
                trigger={
                  <button
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                      freq !== "Does not repeat"
                        ? "border-[var(--color-text-1)] bg-[var(--color-text-1)] text-[var(--color-background)]"
                        : "border-[var(--color-border)] bg-transparent text-[var(--text-3)] hover:bg-[var(--color-surface)]",
                    )}
                  >
                    <UiIcon size={13} icon={RotateCw} />
                    {freq !== "Does not repeat" ? freq : "Repeat"}
                  </button>
                }
                content={
                  <div className="w-[280px] p-3">
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
                          onClick={() => setFreq(f)}
                          className={cn(
                            "text-meta rounded-md border px-2 py-1 font-medium transition-colors",
                            freq === f
                              ? "border-[var(--color-text-1)] bg-[var(--color-text-1)] text-[var(--color-background)]"
                              : "border-[var(--color-border)] bg-transparent text-[var(--text-3)] hover:bg-[var(--color-surface)]",
                          )}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                    {freq === "Weekly" && (
                      <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
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
                            onClick={() =>
                              setDays((prev) =>
                                prev.includes(d.v)
                                  ? prev.filter((x) => x !== d.v)
                                  : [...prev, d.v],
                              )
                            }
                            className={cn(
                              "text-meta rounded-md border px-2 py-1 font-bold transition-colors",
                              days.includes(d.v)
                                ? "border-[#FBBF24] bg-[#FBBF24] text-amber-950"
                                : "border-transparent bg-transparent text-[var(--text-3)] hover:bg-[var(--color-border)]",
                            )}
                          >
                            {d.l}
                          </button>
                        ))}
                      </div>
                    )}
                    {freq === "Custom" && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-meta font-medium text-[var(--text-3)]">
                          Every
                        </span>
                        <input
                          type="number"
                          min="1"
                          value={customInterval}
                          onChange={(e) =>
                            setCustomInterval(
                              Math.max(1, parseInt(e.target.value) || 1),
                            )
                          }
                          className="input !w-14 !px-2 !py-1 !text-center !text-xs"
                        />
                        <Dropdown
                          variant="select"
                          value={customFreq}
                          onChange={(value) => setCustomFreq(value)}
                          options={[
                            { value: "DAILY", label: "Days" },
                            { value: "WEEKLY", label: "Weeks" },
                            { value: "MONTHLY", label: "Months" },
                            { value: "YEARLY", label: "Years" },
                          ]}
                          className="!w-24 !text-xs"
                        />
                      </div>
                    )}
                  </div>
                }
              />
            </div>

            {/* Priority */}
            <div>
              <label className="text-label mb-2 block text-[var(--text-3)]">
                Priority
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  {
                    val: 1,
                    label: "Urgent",
                    colorClass:
                      "bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20",
                    activeClass: "bg-red-500 text-white border-red-500",
                  },
                  {
                    val: 2,
                    label: "High",
                    colorClass:
                      "bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20",
                    activeClass: "bg-amber-500 text-white border-amber-500",
                  },
                  {
                    val: 3,
                    label: "Medium",
                    colorClass:
                      "bg-teal-500/10 text-teal-500 border-teal-500/30 hover:bg-teal-500/20",
                    activeClass: "bg-teal-500 text-white border-teal-500",
                  },
                  {
                    val: 4,
                    label: "Low",
                    colorClass:
                      "bg-slate-500/10 text-slate-500 border-slate-500/30 hover:bg-slate-500/20",
                    activeClass: "bg-slate-500 text-white border-slate-500",
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
                    className={`rounded-full border px-4 py-2 text-xs font-bold transition-all ${priorityValue === p.val ? p.activeClass : p.colorClass}`}
                  >
                    P{p.val} {p.label}
                  </m.button>
                ))}
              </div>
            </div>

            {/* Time Estimate */}
            <div>
              <label className="text-label mb-2 block text-[var(--text-3)]">
                Time Estimate (minutes){" "}
                <span className="text-[var(--text-muted)]">(optional)</span>
              </label>
              <input
                type="number"
                placeholder="e.g. 30"
                value={timeEstimate === null ? "" : timeEstimate}
                onChange={(e) =>
                  setTimeEstimate(
                    e.target.value ? parseInt(e.target.value) : null,
                  )
                }

                min={1}
              />
            </div>

            {/* Linked People */}
            {peopleList.length > 0 && (
              <div>
                <label className="text-label mb-2 block text-[var(--text-3)]">
                  Linked People
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {peopleList.map((person) => {
                    const isLinked = linkedPeopleIds.includes(person.id);
                    return (
                      <button
                        key={person.id}
                        onClick={() => {
                          if (isLinked) {
                            setLinkedPeopleIds((prev) =>
                              prev.filter((id) => id !== person.id),
                            );
                          } else {
                            setLinkedPeopleIds((prev) => [...prev, person.id]);
                          }
                        }}
                        className={cn(
                          "flex items-center gap-2 rounded-full border px-2 py-1.5 transition-all",
                          isLinked
                            ? "border-[var(--accent)] bg-[var(--accent-dim)]"
                            : "border-transparent hover:bg-[var(--color-surface-hover)]",
                        )}
                      >
                        <Avatar
                          name={person.name}
                          initials={person.initials}
                          color={person.color}
                          size="sm"
                        />
                        <span
                          className={cn(
                            "text-sm",
                            isLinked
                              ? "font-medium text-[var(--accent)]"
                              : "text-[var(--text-2)]",
                          )}
                        >
                          {person.name.split(" ")[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Category */}
            <div>
              <label className="text-label mb-2 block text-[var(--text-3)]">
                Category
              </label>
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
                      className={`rounded-full border px-3 py-1.5 text-xs capitalize transition-all ${
                        isActive
                          ? "font-medium shadow-sm"
                          : "hover:bg-[var(--color-surface)]"
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
                    className="input !w-32 !rounded-full !px-3 !py-1.5 !text-xs"
                  />
                ) : (
                  <button
                    onClick={() => setIsAddingCategory(true)}
                    className="rounded-full border border-dashed border-[var(--color-border)] bg-transparent px-3 py-1.5 text-xs text-[var(--color-text-3)] transition-all hover:border-[rgba(255,255,255,0.5)] hover:text-[var(--color-text-1)]"
                  >
                    + Add new category
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="text-label mb-2 block text-[var(--text-3)]">
                Notes
              </label>
              <TextareaAutosize
                data-testid="autosize-textarea"
                placeholder="Additional context or details"
                {...register("notes")}
                minRows={2}
                className={cn(
                  "input resize-none",
                  errors.notes && "!border-red-500",
                )}
                aria-invalid={!!errors.notes}
                aria-describedby={errors.notes ? `notes-error` : undefined}
              />
              {errors.notes && (
                <p id="notes-error" className="text-caption mt-1 text-red-500">
                  {errors.notes.message}
                </p>
              )}
            </div>
          </div>

          {/* Sticky Bottom Bar */}
          <div className="flex gap-3 border-t border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] p-4 md:rounded-b-2xl">
            {taskToEdit && (
              <Button
                variant="danger"
                onClick={() => setDeleteTaskConfirm(true)}
                className="flex items-center justify-center px-3"
              >
                <UiIcon
                  size={14}
                  strokeWidth={1.5}
                  className="shrink-0"
                  icon={Trash2}
                />
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !isValid}
              className="w-full flex-1 py-3 disabled:opacity-50"
            >
              {isSubmitting ? (
                <UiIcon
                  size={14}
                  strokeWidth={1.5}
                  className="shrink-0 animate-spin"
                  icon={Loader2}
                />
              ) : taskToEdit ? (
                "Save Changes"
              ) : (
                "Save Task"
              )}
            </Button>
          </div>
        </form>
      </Sheet>
      <ConfirmModal
        isOpen={deleteTaskConfirm}
        onClose={() => setDeleteTaskConfirm(false)}
        onConfirm={confirmDelete}
        title="Move Task to Trash?"
        description="This task will leave active views and can be restored from Trash."
        confirmLabel="Move to Trash"
        confirmDestructive
      />
      <ConfirmModal
        isOpen={showUnsavedWarning}
        onClose={() => setShowUnsavedWarning(false)}
        onConfirm={() => {
          setShowUnsavedWarning(false);
          onClose();
        }}
        title="Discard Changes?"
        description="You have unsaved changes. Are you sure you want to discard them?"
        confirmLabel="Discard"
        confirmDestructive={false}
      />
    </>
  );
}
