import { logger } from "@/lib/logger";
import React, { useState, useEffect } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { m, AnimatePresence } from "framer-motion";
import { X, Calendar, Loader2, RotateCw, Trash2, Check } from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { Popover } from "@/components/ui/Popover";
import { Avatar } from "@/components/ui/Avatar";
import "@/lib/chrono-custom"; // registers custom parsers on chrono.casual
import { createClient } from "@/lib/supabase";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "sonner";
import * as chrono from "chrono-node";
import { DEFAULT_DO_COLORS } from "@/lib/constants";
import { useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

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

interface TaskAddPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskAdded?: () => void;
  taskToEdit?: TaskEditData | null;
}

export function TaskAddPanel({ isOpen, onClose, onTaskAdded, taskToEdit }: TaskAddPanelProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [parsedDeadline, setParsedDeadline] = useState<Date | null>(null);
  const [startDate, setStartDate] = useState("");
  const [parsedStartDate, setParsedStartDate] = useState<Date | null>(null);
  const [isManualDate, setIsManualDate] = useState(false);
  const [category, setCategory] = useState("work");
  const [priority, setPriority] = useState<number | null>(null);
  const [timeEstimate, setTimeEstimate] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [firstStep, setFirstStep] = useState("");
  const [subtasks, setSubtasks] = useState<{id: string, text: string, completed: boolean}[]>([]);
  const [linkedPeopleIds, setLinkedPeopleIds] = useState<string[]>([]);
  const [peopleList, setPeopleList] = useState<{id: string, name: string, initials: string, color: string}[]>([]);

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

  const { userSettings } = useAppStore();

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCategoriesList(userSettings?.do_categories || ["work", "study", "personal", "errand", "health"]);
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
      setCategory(name);
      
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Update userSettings in DB
        const updatedSettings = { ...userSettings, do_categories: newList };
        await supabase.from("user_settings").update({ do_categories: newList }).eq("user_id", user.id);
        useAppStore.getState().setUserSettings(updatedSettings);
      }
    } else {
      setCategory(name);
    }
    setNewCategoryName("");
    setIsAddingCategory(false);
  };

  const confirmDelete = async () => {
    if (!taskToEdit) return;

    // Save current caches for possible rollback
    const previousTasks = queryClient.getQueryData<TaskEditData[]>(["tasks"]);
    const previousDashboard = queryClient.getQueryData<{ tasks: TaskEditData[] }>(["dashboard"]);

    // Optimistically remove from ["tasks"]
    queryClient.setQueryData<TaskEditData[]>(["tasks"], old => old?.filter(t => t.id !== taskToEdit.id) ?? []);

    // Optimistically remove from ["dashboard"]
    queryClient.setQueryData<{ tasks: TaskEditData[] }>(["dashboard"], old => {
      if (!old) return old;
      return {
        ...old,
        tasks: old.tasks?.filter(t => t.id !== taskToEdit.id) ?? []
      };
    });

    try {
      useAppStore.getState().markMutation();
      const supabase = createClient();
      const { error } = await supabase.from("items").delete().eq("id", taskToEdit.id);
      if (error) throw error;
      
      toast.success("Task deleted");
      if (onTaskAdded) onTaskAdded();
      onClose();
    } catch (err: unknown) {
      // Rollback on failure
      queryClient.setQueryData(["tasks"], previousTasks);
      queryClient.setQueryData(["dashboard"], previousDashboard);

      const message = err instanceof Error ? err.message : "Failed to delete task";
      toast.error("Failed to delete task", { description: message });
    } finally {
      setDeleteTaskConfirm(false);
    }
  };

  useEffect(() => {
    async function fetchPeople() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data } = await supabase.from('people').select('id, name, initials, color').eq('user_id', userData.user.id).order('name');
      if (data) setPeopleList(data);
    }
    if (isOpen) {
      fetchPeople();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (taskToEdit) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTitle(taskToEdit.title || "");
        setIsManualDate(false);
        setCategory(taskToEdit.category || "work");
        setPriority(taskToEdit.priority || null);
        setTimeEstimate(taskToEdit.time_estimate || null);
        setNotes(taskToEdit.notes || "");
        setFirstStep(taskToEdit.first_step || "");
        setSubtasks(taskToEdit.subtasks || []);
        setLinkedPeopleIds(taskToEdit.linked_people_ids || []);
        
        if (taskToEdit.recurrence) {
          if (taskToEdit.recurrence === "FREQ=DAILY") setFreq("Daily");
          else if (taskToEdit.recurrence === "FREQ=MONTHLY") setFreq("Monthly");
          else if (taskToEdit.recurrence.includes("FREQ=WEEKLY")) {
            setFreq("Weekly");
            const match = taskToEdit.recurrence.match(/BYDAY=([A-Z,]+)/);
            if (match) setDays(match[1].split(','));
          } else if (taskToEdit.recurrence.includes("INTERVAL=")) {
            setFreq("Custom");
            setCustomRRule(taskToEdit.recurrence);
            // Try to parse interval and freq
            const matchInterval = taskToEdit.recurrence.match(/INTERVAL=(\d+)/);
            if (matchInterval) setCustomInterval(parseInt(matchInterval[1]));
            const matchFreq = taskToEdit.recurrence.match(/FREQ=([A-Z]+)/);
            if (matchFreq) setCustomFreq(matchFreq[1]);
          } else {
            setFreq("Custom");
            setCustomRRule(taskToEdit.recurrence);
          }
        } else {
          setFreq("Does not repeat");
        }
        
        if (taskToEdit.deadline) {
          const d = new Date(taskToEdit.deadline);
          setParsedDeadline(d);
          setDeadline(format(d, "yyyy-MM-dd'T'HH:mm"));
        } else {
          setParsedDeadline(null);
          setDeadline("");
        }
        
        if (taskToEdit.start_date) {
          const d = new Date(taskToEdit.start_date);
          setParsedStartDate(d);
          setStartDate(format(d, "yyyy-MM-dd'T'HH:mm"));
        } else {
          setParsedStartDate(null);
          setStartDate("");
        }
      } else {
        setTitle("");
        setDeadline("");
        setParsedDeadline(null);
        setStartDate("");
        setParsedStartDate(null);
        setFreq("Does not repeat");
        setDays([]);
        setCustomRRule("");
        setIsManualDate(false);
        setCategory("work");
        setPriority(null);
        setTimeEstimate(null);
        setNotes("");
        setFirstStep("");
        setSubtasks([]);
        setLinkedPeopleIds([]);
      }
    }
  }, [isOpen, taskToEdit]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (!isManualDate && userSettings?.nlp_date_parsing !== false) {
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
              : parsedResults.reduce((a, b) =>
                  a.start.date() > b.start.date() ? a : b
                ).start.date();
        }
        setParsedDeadline(d);
        setDeadline(format(d, "yyyy-MM-dd'T'HH:mm"));
      } else {
        setParsedDeadline(null);
        setDeadline("");
      }
    }
  };

  const handleManualDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsManualDate(true);
    if (e.target.value) {
      setParsedDeadline(new Date(e.target.value));
      setDeadline(e.target.value);
    } else {
      setParsedDeadline(null);
      setDeadline("");
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
      setDeadline("");
      return;
    }
    setParsedDeadline(d);
    setDeadline(format(d, "yyyy-MM-dd'T'HH:mm"));
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {


        let finalRecurrence = null;
        if (freq === "Daily") finalRecurrence = "FREQ=DAILY";
        else if (freq === "Monthly") finalRecurrence = "FREQ=MONTHLY";
        else if (freq === "Weekly") {
          finalRecurrence = "FREQ=WEEKLY";
          if (days.length > 0) finalRecurrence += `;BYDAY=${days.join(',')}`;
        } else if (freq === "Custom") {
          if (customInterval > 1) {
            finalRecurrence = `FREQ=${customFreq};INTERVAL=${customInterval}`;
          } else {
            finalRecurrence = customRRule.trim() || null;
          }
        }

        let finalTitle = title.trim();
        if (parsedDeadline && !isManualDate) {
          const parsedResults = chrono.parse(finalTitle);
          if (parsedResults && parsedResults.length > 0) {
            parsedResults.forEach(r => {
              finalTitle = finalTitle.replace(r.text, '');
            });
            finalTitle = finalTitle.replace(/\s+/g, ' ').trim();
            finalTitle = finalTitle.replace(/^(remind me to|remember to|need to|have to|must|gotta)\s+/i, '');
            if (finalTitle.length > 0) finalTitle = finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
          }
        }

        const payload: Record<string, unknown> = {
          user_id: user.id,
          title: finalTitle || title.trim(),
          first_step: firstStep.trim() || null,
          ifthen_trigger: null,
          deadline: parsedDeadline ? parsedDeadline.toISOString() : null,
          start_date: parsedStartDate ? parsedStartDate.toISOString() : null,
          recurrence: finalRecurrence,
          category,
          status: "active",
          priority: priority ?? 4,
          time_estimate: timeEstimate,
          notes: notes.trim() || null,
          subtasks: subtasks.filter(st => st.text.trim() !== ""),
          linked_people_ids: linkedPeopleIds
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
          const res = await supabase.from("items").update(payload).eq("id", taskToEdit.id);
          error = res.error;
        } else {
          const res = await supabase.from("items").insert(payload);
          error = res.error;
        }
        
        if (error) {
          logger.error("Save error:", error);
          toast.error(`Failed to ${taskToEdit ? "update" : "save"} task`, { description: error.message });
          setSaving(false);
          return;
        }
        
        toast.success(`Task ${taskToEdit ? "updated" : "saved"} successfully`);
        if (onTaskAdded) onTaskAdded();
        onClose();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not save task";
      toast.error("Unexpected error", { description: message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <>
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed -inset-[100px] bg-black/60 backdrop-blur-sm z-40 transform-gpu"
          />
          
          <m.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed top-0 right-0 h-[100dvh] w-full md:top-3 md:right-3 md:h-[calc(100dvh-24px)] md:w-[480px] md:rounded-2xl bg-[var(--color-surface)] backdrop-blur-2xl border-l md:border border-[var(--color-border)] z-50 flex flex-col shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] md:rounded-t-2xl">
              <h2 className="text-lg font-bold text-[var(--color-text-1)]">{taskToEdit ? "Edit Task" : "Add Task"}</h2>
              <button onClick={onClose} className="btn-icon">
                <X size={16} strokeWidth={1.5} className="shrink-0" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Title */}
              <div>
                <label className="text-label text-[var(--text-3)] block mb-2">
                  Task Name <span className="text-red-400">*</span>
                </label>
                <input
                  autoFocus
                  placeholder="What needs to be done?"
                  value={title}
                  onChange={handleTitleChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSave();
                    }
                  }}
                  className="input-title"
                />
              </div>

              {/* Subtasks */}
              <div>
                <label className="text-label text-[var(--text-3)] block mb-2">Subtasks</label>
                <div className="space-y-1.5">
                  {subtasks.map((st, i) => (
                    <div key={st.id} className="flex items-center gap-2 group">
                      <button
                        onClick={() => {
                          setSubtasks(subtasks.map((st, idx) => idx === i ? { ...st, completed: !st.completed } : st));
                        }}
                        className={cn("w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0", st.completed ? "bg-[var(--color-text-3)] border-[var(--color-text-3)]" : "border-[var(--color-border)] hover:border-[var(--color-text-3)]")}
                      >
                        {st.completed && <Check className="w-3 h-3 text-[var(--color-background)]" />}
                      </button>
                      <input
                        value={st.text}
                        onChange={(e) => {
                          setSubtasks(subtasks.map((st, idx) => idx === i ? { ...st, text: e.target.value } : st));
                        }}
                        placeholder="Subtask..."
                        className={cn("flex-1 bg-transparent border-none text-sm focus:outline-none placeholder:text-[var(--text-4)]", st.completed && "line-through text-[var(--text-4)]")}
                      />
                      <button onClick={() => setSubtasks(subtasks.filter((_, idx) => idx !== i))} className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-4)] hover:text-[#F87171] transition-all">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => setSubtasks([...subtasks, { id: Date.now().toString(), text: "", completed: false }])} className="text-xs text-[var(--text-3)] hover:text-[var(--text-1)] flex items-center gap-1.5 transition-colors mt-2">
                    <span className="text-lg leading-none font-light">+</span> Add subtask
                  </button>
                </div>
              </div>

              {/* First Step */}
              <div>
                <label className="text-label text-[var(--text-3)] block mb-2">First Step <span className="text-[var(--text-4)]">(optional)</span></label>
                <input
                  placeholder="What's the smallest action to start this?"
                  value={firstStep}
                  onChange={(e) => setFirstStep(e.target.value)}
                  className="input"
                />
              </div>

              {/* Action Toolbar (Date & Repeat) */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-border)]">
                <Popover
                  trigger={
                    <button className={cn("px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all", deadline ? "bg-[var(--color-text-1)] text-[var(--color-background)] border-[var(--color-text-1)]" : "bg-transparent text-[var(--text-3)] border-[var(--color-border)] hover:bg-[var(--color-surface)]")}>
                      <Calendar size={13} />
                      {deadline ? (() => {
                        const d = new Date(deadline);
                        const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
                        const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
                        const timeStr = hasTime ? ` ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : "";
                        return `${dateStr}${timeStr}`;
                      })() : "Due Date"}
                    </button>
                  }
                  content={
                    <div className="p-3 w-[280px] space-y-4">
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { id: "today", label: "Today" },
                          { id: "tomorrow", label: "Tomorrow" },
                          { id: "weekend", label: "This Weekend" },
                          { id: "next_week", label: "Next Week" },
                          { id: "none", label: "No Date" }
                        ].map((btn) => (
                          <button
                            key={btn.id}
                            onClick={() => setQuickDate(btn.id)}
                            className="px-2 py-1 rounded-md text-[11px] font-medium bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--text-2)] hover:bg-[var(--color-border)] transition-colors"
                          >
                            {btn.label}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-4)] block mb-1.5">Due Date/Time</label>
                          <input
                            type="datetime-local"
                            value={deadline || ""}
                            onChange={handleManualDateChange}
                            className="input !py-1.5 !px-2 !text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-4)] block mb-1.5">Start Date</label>
                          <input
                            type="datetime-local"
                            value={startDate || ""}
                            onChange={(e) => {
                              setStartDate(e.target.value);
                              setParsedStartDate(e.target.value ? new Date(e.target.value) : null);
                            }}
                            className="input !py-1.5 !px-2 !text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  }
                />

                <Popover
                  trigger={
                    <button className={cn("px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all", freq !== "Does not repeat" ? "bg-[var(--color-text-1)] text-[var(--color-background)] border-[var(--color-text-1)]" : "bg-transparent text-[var(--text-3)] border-[var(--color-border)] hover:bg-[var(--color-surface)]")}>
                      <RotateCw size={13} />
                      {freq !== "Does not repeat" ? freq : "Repeat"}
                    </button>
                  }
                  content={
                    <div className="p-3 w-[280px]">
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {["Does not repeat", "Daily", "Weekly", "Monthly", "Custom"].map(f => (
                          <button
                            key={f}
                            onClick={() => setFreq(f)}
                            className={cn("px-2 py-1 rounded-md text-[11px] font-medium transition-colors border", freq === f ? 'bg-[var(--color-text-1)] text-[var(--color-background)] border-[var(--color-text-1)]' : 'bg-transparent text-[var(--text-3)] border-[var(--color-border)] hover:bg-[var(--color-surface)]')}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                      {freq === "Weekly" && (
                        <div className="flex flex-wrap gap-1 p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                          {[
                            { l: 'Mo', v: 'MO' }, { l: 'Tu', v: 'TU' }, { l: 'We', v: 'WE' }, 
                            { l: 'Th', v: 'TH' }, { l: 'Fr', v: 'FR' }, { l: 'Sa', v: 'SA' }, { l: 'Su', v: 'SU' }
                          ].map((d) => (
                            <button
                              key={d.v}
                              onClick={() => setDays(prev => prev.includes(d.v) ? prev.filter(x => x !== d.v) : [...prev, d.v])}
                              className={cn("px-2 py-1 rounded-md text-[11px] font-bold transition-colors border", days.includes(d.v) ? 'bg-[#FBBF24] text-amber-950 border-[#FBBF24]' : 'bg-transparent text-[var(--text-3)] border-transparent hover:bg-[var(--color-border)]')}
                            >
                              {d.l}
                            </button>
                          ))}
                        </div>
                      )}
                      {freq === "Custom" && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[11px] text-[var(--text-3)] font-medium">Every</span>
                          <input
                            type="number"
                            min="1"
                            value={customInterval}
                            onChange={(e) => setCustomInterval(Math.max(1, parseInt(e.target.value) || 1))}
                            className="input !w-14 !py-1 !px-2 !text-center !text-xs"
                          />
                          <Dropdown variant="select"
                            value={customFreq}
                            onChange={(value) => setCustomFreq(value)}
                            options={[
                              { value: "DAILY", label: "Days" },
                              { value: "WEEKLY", label: "Weeks" },
                              { value: "MONTHLY", label: "Months" },
                              { value: "YEARLY", label: "Years" }
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
                <label className="text-label text-[var(--text-3)] block mb-2">Priority</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { val: 1, label: "Urgent", colorClass: "bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20", activeClass: "bg-red-500 text-white border-red-500" },
                    { val: 2, label: "High", colorClass: "bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20", activeClass: "bg-amber-500 text-white border-amber-500" },
                    { val: 3, label: "Medium", colorClass: "bg-teal-500/10 text-teal-500 border-teal-500/30 hover:bg-teal-500/20", activeClass: "bg-teal-500 text-white border-teal-500" },
                    { val: 4, label: "Low", colorClass: "bg-slate-500/10 text-slate-500 border-slate-500/30 hover:bg-slate-500/20", activeClass: "bg-slate-500 text-white border-slate-500" }
                  ].map((p) => (
                    <m.button
                      key={p.val}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setPriority(priority === p.val ? null : p.val)}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${priority === p.val ? p.activeClass : p.colorClass}`}
                    >
                      P{p.val} {p.label}
                    </m.button>
                  ))}
                </div>
              </div>

              {/* Time Estimate */}
              <div>
                <label className="text-label text-[var(--text-3)] block mb-2">Time Estimate (minutes) <span className="text-[var(--text-4)]">(optional)</span></label>
                <input
                  type="number"
                  placeholder="e.g. 30"
                  value={timeEstimate === null ? "" : timeEstimate}
                  onChange={(e) => setTimeEstimate(e.target.value ? parseInt(e.target.value) : null)}
                  className="input"
                  min={1}
                />
              </div>

              {/* Linked People */}
              {peopleList.length > 0 && (
                <div>
                  <label className="text-label text-[var(--text-3)] block mb-2">Linked People</label>
                  <div className="flex flex-wrap gap-2 items-center">
                    {peopleList.map(person => {
                      const isLinked = linkedPeopleIds.includes(person.id);
                      return (
                        <button
                          key={person.id}
                          onClick={() => {
                            if (isLinked) {
                              setLinkedPeopleIds(prev => prev.filter(id => id !== person.id));
                            } else {
                              setLinkedPeopleIds(prev => [...prev, person.id]);
                            }
                          }}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded-full transition-all border",
                            isLinked ? "border-[var(--accent)] bg-[var(--accent-dim)]" : "border-transparent hover:bg-[var(--color-surface-hover)]"
                          )}
                        >
                          <Avatar name={person.name} initials={person.initials} color={person.color} size="sm" />
                          <span className={cn("text-sm", isLinked ? "text-[var(--accent)] font-medium" : "text-[var(--text-2)]")}>
                            {person.name.split(' ')[0]}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Category */}
              <div>
                <label className="text-label text-[var(--text-3)] block mb-2">Category</label>
                <div className="flex flex-wrap gap-2 items-center">
                  {categoriesList.map((cat: string) => {
                    const cColor = DEFAULT_DO_COLORS[cat] || "var(--color-text-3)";
                    const isActive = category === cat;
                    return (
                      <m.button
                        key={cat}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => setCategory(isActive ? "" : cat)}
                        style={{
                          borderColor: isActive ? cColor : `${cColor}40`,
                          backgroundColor: isActive ? `${cColor}20` : "transparent",
                          color: isActive ? cColor : "var(--color-text-3)"
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs capitalize transition-all border ${
                          isActive ? "font-medium shadow-sm" : "hover:bg-[var(--color-surface)]"
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
                      className="input !w-32 !py-1.5 !px-3 !rounded-full !text-xs"
                    />
                  ) : (
                    <button
                      onClick={() => setIsAddingCategory(true)}
                      className="px-3 py-1.5 rounded-full text-xs bg-transparent text-[var(--color-text-3)] border border-dashed border-[var(--color-border)] hover:border-[rgba(255,255,255,0.5)] hover:text-[var(--color-text-1)] transition-all"
                    >
                      + Add new category
                    </button>
                  )}
                </div>
              </div>


              <div>
                <label className="text-label text-[var(--text-3)] block mb-2">Notes</label>
                <TextareaAutosize
                  placeholder="Additional context or details"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  minRows={2}
                  className="input resize-none"
                />
              </div>
            </div>

            {/* Sticky Bottom Bar */}
            <div className="p-4 border-t border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] flex gap-3 md:rounded-b-2xl">
              {taskToEdit && (
                <button
                  onClick={() => setDeleteTaskConfirm(true)}
                  className="btn-danger px-3 flex items-center justify-center"
                >
                  <Trash2 size={14} strokeWidth={1.5} className="shrink-0" />
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="flex-1 btn-primary py-3 w-full disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin shrink-0" /> : (taskToEdit ? "Save Changes" : "Save Task")}
              </button>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
    <ConfirmModal
      isOpen={deleteTaskConfirm}
      onClose={() => setDeleteTaskConfirm(false)}
      onConfirm={confirmDelete}
      title="Delete Task?"
      description="This task will be permanently deleted. This action cannot be undone."
      confirmLabel="Delete"
      confirmDestructive
    />
    </>
  );
}

