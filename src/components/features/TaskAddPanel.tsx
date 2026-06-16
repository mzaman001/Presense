import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Flag, Loader2, RotateCw, Trash2, ArrowRight, Check } from "lucide-react";
import { SelectDropdown } from "@/components/ui/SelectDropdown";
import { Popover } from "@/components/ui/Popover";
import { createClient } from "@/lib/supabase";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "sonner";
import * as chrono from "chrono-node";
import nlp from "compromise";

import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

interface TaskAddPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskAdded?: () => void;
  taskToEdit?: any; // To support edit mode
}

export function TaskAddPanel({ isOpen, onClose, onTaskAdded, taskToEdit }: TaskAddPanelProps) {
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [parsedDeadline, setParsedDeadline] = useState<Date | null>(null);
  const [startDate, setStartDate] = useState("");
  const [parsedStartDate, setParsedStartDate] = useState<Date | null>(null);
  const [isManualDate, setIsManualDate] = useState(false);
  const [category, setCategory] = useState("work");
  const [priority, setPriority] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [subtasks, setSubtasks] = useState<{id: string, text: string, completed: boolean}[]>([]);

  const [recurrence, setRecurrence] = useState("");
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { userSettings } = useAppStore();

  useEffect(() => {
    if (isOpen) {
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
    try {
      useAppStore.getState().markMutation();
      const supabase = createClient();
      const { error } = await supabase.from("items").delete().eq("id", taskToEdit.id);
      if (error) throw error;
      toast.success("Task deleted");
      if (onTaskAdded) onTaskAdded();
      onClose();
    } catch (err: any) {
      toast.error("Failed to delete task", { description: err.message });
    } finally {
      setDeleteTaskConfirm(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (taskToEdit) {
        setTitle(taskToEdit.title || "");
        setIsManualDate(!!taskToEdit.deadline);
        setCategory(taskToEdit.category || "work");
        setPriority(taskToEdit.priority || null);
        setNotes(taskToEdit.notes || "");
        setSubtasks(taskToEdit.subtasks || []);
        setRecurrence(taskToEdit.recurrence || "");
        
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
          setDeadline(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
        } else {
          setParsedDeadline(null);
          setDeadline("");
        }
        
        if (taskToEdit.start_date) {
          const d = new Date(taskToEdit.start_date);
          setParsedStartDate(d);
          setStartDate(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
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
        setRecurrence("");
        setFreq("Does not repeat");
        setDays([]);
        setCustomRRule("");
        setIsManualDate(false);
        setCategory("work");
        setPriority(null);
        setNotes("");
        setSubtasks([]);
      }
      setErrorMsg(null);
    }
  }, [isOpen, taskToEdit]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (!isManualDate && userSettings?.nlp_date_parsing !== false) {
      const parsedResults = chrono.parse(val);
      if (parsedResults && parsedResults.length > 0 && parsedResults[0].start) {
        const d = parsedResults[0].start.date();
        setParsedDeadline(d);
        setDeadline(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
      } else {
        setParsedDeadline(null);
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
    setDeadline(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    
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
        if (parsedDeadline) {
          const doc = nlp(finalTitle) as any;
          const dates = doc.dates().json();
          if (dates && dates.length > 0 && dates[0].text) {
            finalTitle = finalTitle.replace(new RegExp(dates[0].text, 'i'), '').replace(/\s+/g, ' ').trim();
            finalTitle = finalTitle.replace(/^(remind me to|remember to|need to|have to|must|gotta)\s+/i, '');
            if (finalTitle.length > 0) finalTitle = finalTitle.charAt(0).toUpperCase() + finalTitle.slice(1);
          }
        }

        const payload: any = {
          user_id: user.id,
          title: finalTitle || title.trim(),
          first_step: null,
          ifthen_trigger: null,
          deadline: parsedDeadline ? parsedDeadline.toISOString() : null,
          start_date: parsedStartDate ? parsedStartDate.toISOString() : null,
          recurrence: finalRecurrence,
          category,
          status: "active",
          priority: priority ?? 4,
          notes: notes.trim() || null,
          subtasks: subtasks.filter(st => st.text.trim() !== "")
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
          console.error("Save error:", error);
          setErrorMsg(error.message);
          toast.error(`Failed to ${taskToEdit ? "update" : "save"} task`, { description: error.message });
          setSaving(false);
          return;
        }
        
        toast.success(`Task ${taskToEdit ? "updated" : "saved"} successfully`);
        if (onTaskAdded) onTaskAdded();
        onClose();
      }
    } catch (err: any) {
      toast.error("Unexpected error", { description: err.message || "Could not save task" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed top-0 right-0 h-[100dvh] w-full md:w-[480px] bg-[var(--color-surface)] border-l border-[var(--color-border)] z-50 flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[rgba(255,255,255,0.02)]">
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
                          const newSt = [...subtasks];
                          newSt[i].completed = !newSt[i].completed;
                          setSubtasks(newSt);
                        }}
                        className={cn("w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0", st.completed ? "bg-[var(--color-text-3)] border-[var(--color-text-3)]" : "border-[var(--color-border)] hover:border-[var(--color-text-3)]")}
                      >
                        {st.completed && <Check className="w-3 h-3 text-[var(--color-background)]" />}
                      </button>
                      <input
                        value={st.text}
                        onChange={(e) => {
                          const newSt = [...subtasks];
                          newSt[i].text = e.target.value;
                          setSubtasks(newSt);
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

              {/* Action Toolbar (Date & Repeat) */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-border)]">
                <Popover
                  trigger={
                    <button className={cn("px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 transition-all", deadline ? "bg-[var(--color-text-1)] text-[var(--color-background)] border-[var(--color-text-1)]" : "bg-transparent text-[var(--text-3)] border-[var(--color-border)] hover:bg-[var(--color-surface)]")}>
                      <Calendar size={13} />
                      {deadline ? new Date(deadline).toLocaleDateString() : "Due Date"}
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
                            className="input [color-scheme:dark] !py-1.5 !px-2 !text-xs"
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
                            className="input [color-scheme:dark] !py-1.5 !px-2 !text-xs"
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
                          <SelectDropdown
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
                    { val: 1, label: "Urgent", colorClass: "bg-[#F87171]/10 text-[#F87171] border-[#F87171]/30 hover:bg-[#F87171]/20", activeClass: "bg-[#F87171] text-white border-[#F87171]" },
                    { val: 2, label: "High", colorClass: "bg-[#FBBF24]/10 text-[#FBBF24] border-[#FBBF24]/30 hover:bg-[#FBBF24]/20", activeClass: "bg-[#FBBF24] text-amber-950 border-[#FBBF24]" },
                    { val: 3, label: "Medium", colorClass: "bg-[#2DD4BF]/10 text-[#2DD4BF] border-[#2DD4BF]/30 hover:bg-[#2DD4BF]/20", activeClass: "bg-[#2DD4BF] text-teal-950 border-[#2DD4BF]" },
                    { val: 4, label: "Low", colorClass: "bg-[#9CA3AF]/10 text-[#9CA3AF] border-[#9CA3AF]/30 hover:bg-[#9CA3AF]/20", activeClass: "bg-[#9CA3AF] text-gray-950 border-[#9CA3AF]" }
                  ].map((p) => (
                    <button
                      key={p.val}
                      onClick={() => setPriority(priority === p.val ? null : p.val)}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${priority === p.val ? p.activeClass : p.colorClass}`}
                    >
                      P{p.val} {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="text-label text-[var(--text-3)] block mb-2">Category</label>
                <div className="flex flex-wrap gap-2 items-center">
                  {categoriesList.map((cat: string) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs capitalize transition-all border ${
                        category === cat
                          ? "bg-[var(--color-text-1)] text-[var(--color-background)] border-[var(--color-text-1)] font-medium"
                          : "bg-transparent text-[var(--color-text-3)] border-[var(--color-border)] hover:border-[var(--color-text-3)]"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
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
                <textarea
                  placeholder="Additional context or details"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            {/* Sticky Bottom Bar */}
            <div className="p-4 border-t border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] flex gap-3">
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
          </motion.div>
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

