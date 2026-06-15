import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Flag, Loader2, RotateCw, Trash2, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "sonner";
import * as chrono from "chrono-node";
import nlp from "compromise";

import { useAppStore } from "@/store/useAppStore";

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
  const [firstStep, setFirstStep] = useState("");
  const [ifThen, setIfThen] = useState("");
  const [category, setCategory] = useState("work");
  const [priority, setPriority] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const [recurrence, setRecurrence] = useState("");
  const [freq, setFreq] = useState("Does not repeat");
  const [days, setDays] = useState<string[]>([]);
  const [customRRule, setCustomRRule] = useState("");

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
        setFirstStep(taskToEdit.first_step || "");
        setIfThen(taskToEdit.ifthen_trigger || "");
        setCategory(taskToEdit.category || "work");
        setPriority(taskToEdit.priority || null);
        setNotes(taskToEdit.notes || "");
        setRecurrence(taskToEdit.recurrence || "");
        
        if (taskToEdit.recurrence) {
          if (taskToEdit.recurrence === "FREQ=DAILY") setFreq("Daily");
          else if (taskToEdit.recurrence === "FREQ=MONTHLY") setFreq("Monthly");
          else if (taskToEdit.recurrence.includes("FREQ=WEEKLY")) {
            setFreq("Weekly");
            const match = taskToEdit.recurrence.match(/BYDAY=([A-Z,]+)/);
            if (match) setDays(match[1].split(','));
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
        setFirstStep("");
        setIfThen("");
        setCategory("work");
        setPriority(null);
        setNotes("");
      }
      setErrorMsg(null);
    }
  }, [isOpen, taskToEdit]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (!deadline && userSettings?.nlp_date_parsing !== false) {
      const parsedResults = chrono.parse(val);
      if (parsedResults && parsedResults.length > 0 && parsedResults[0].start) {
        const d = parsedResults[0].start.date();
        setParsedDeadline(d);
        setDeadline(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
      } else {
        setParsedDeadline(null);
        setDeadline("");
      }
    }
  };

  const handleManualDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setParsedDeadline(new Date(e.target.value));
      setDeadline(e.target.value);
    } else {
      setParsedDeadline(null);
      setDeadline("");
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        let triggerText = ifThen.trim();
        if (triggerText && !triggerText.startsWith("When ")) {
          triggerText = `When ${triggerText}, I will ${firstStep.trim()}`;
        }

        let finalRecurrence = null;
        if (freq === "Daily") finalRecurrence = "FREQ=DAILY";
        else if (freq === "Monthly") finalRecurrence = "FREQ=MONTHLY";
        else if (freq === "Weekly") {
          finalRecurrence = "FREQ=WEEKLY";
          if (days.length > 0) finalRecurrence += `;BYDAY=${days.join(',')}`;
        } else if (freq === "Custom") {
          finalRecurrence = customRRule.trim() || null;
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
          first_step: firstStep.trim() || null,
          ifthen_trigger: triggerText || null,
          deadline: parsedDeadline ? parsedDeadline.toISOString() : null,
          start_date: parsedStartDate ? parsedStartDate.toISOString() : null,
          recurrence: finalRecurrence,
          category,
          status: "active",
          priority: priority ?? 4,
          notes: notes.trim() || null
        };

        if (taskToEdit && taskToEdit.deadline !== payload.deadline) {
          payload.notification_sent_72h = false;
          payload.notification_sent_24h = false;
          payload.notification_sent_6h = false;
          payload.notification_sent_1h = false;
          payload.notification_sent_overdue = false;
        }

        let error;
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
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-[var(--color-background)] border-l border-[var(--color-border)] z-50 flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between p-6 pb-2">
              <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-[var(--color-surface)] transition-colors text-[var(--color-text-3)]">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-8">
              {/* Title */}
              <div>
                <input
                  autoFocus
                  placeholder="Task title..."
                  value={title}
                  onChange={handleTitleChange}
                  className="w-full bg-transparent text-3xl font-bold text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] outline-none border-b border-transparent focus:border-[var(--color-border)] pb-2 transition-colors"
                />
              </div>

              {/* Dates Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-2">Deadline</label>
                  <input
                    type="datetime-local"
                    value={deadline || ""}
                    onChange={handleManualDateChange}
                    className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-xl px-3 py-2 text-sm text-[var(--color-text-1)] outline-none focus:border-[var(--color-accent)] transition-colors [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-2">Start Date</label>
                  <input
                    type="datetime-local"
                    value={startDate || ""}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setParsedStartDate(e.target.value ? new Date(e.target.value) : null);
                    }}
                    className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-xl px-3 py-2 text-sm text-[var(--color-text-1)] outline-none focus:border-[var(--color-accent)] transition-colors [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* Recurrence */}
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-2">Repeats</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {["Does not repeat", "Daily", "Weekly", "Monthly", "Custom"].map(f => (
                    <button
                      key={f}
                      onClick={() => setFreq(f)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border ${freq === f ? 'bg-[var(--color-text-1)] text-[var(--color-background)] border-[var(--color-text-1)]' : 'bg-transparent text-[var(--color-text-3)] border-[var(--color-border)] hover:text-[var(--color-text-1)]'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                {freq === "Weekly" && (
                  <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                    {[
                      { l: 'Mo', v: 'MO' }, { l: 'Tu', v: 'TU' }, { l: 'We', v: 'WE' }, 
                      { l: 'Th', v: 'TH' }, { l: 'Fr', v: 'FR' }, { l: 'Sa', v: 'SA' }, { l: 'Su', v: 'SU' }
                    ].map((d, i) => (
                      <button
                        key={`${d.v}-${i}`}
                        onClick={() => setDays(prev => prev.includes(d.v) ? prev.filter(x => x !== d.v) : [...prev, d.v])}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${days.includes(d.v) ? 'bg-[#FBBF24] text-amber-950' : 'bg-[var(--color-surface)] text-[var(--color-text-3)] hover:text-[var(--color-text-1)] border border-[var(--color-border)]'}`}
                      >
                        {d.l}
                      </button>
                    ))}
                  </div>
                )}
                {freq === "Custom" && (
                  <input
                    placeholder="e.g. FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1"
                    value={customRRule}
                    onChange={(e) => setCustomRRule(e.target.value)}
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] outline-none focus:border-[var(--color-accent)] transition-colors"
                  />
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-2">Priority</label>
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
                <label className="block text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-2">Category</label>
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
                      className="px-3 py-1.5 rounded-full text-xs bg-[var(--color-surface)] text-[var(--color-text-1)] outline-none border border-[var(--color-accent)] w-28"
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

              {/* First Step */}
              <div>
                <textarea
                  placeholder="What is the absolute smallest action to start this? (optional)"
                  value={firstStep}
                  onChange={(e) => setFirstStep(e.target.value)}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] outline-none focus:border-[#2DD4BF] resize-none h-20 transition-colors"
                />
              </div>

              {/* If-Then Trigger */}
              <div>
                <input
                  placeholder="e.g. At my desk after dinner / On the bus tomorrow morning (optional)"
                  value={ifThen}
                  onChange={(e) => setIfThen(e.target.value)}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] outline-none focus:border-[#F472B6] transition-colors"
                />
              </div>

              {/* Notes */}
              <div>
                <textarea
                  placeholder="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] outline-none focus:border-[var(--color-accent)] resize-none h-24 transition-colors"
                />
              </div>
            </div>

            {/* Sticky Bottom Bar */}
            <div className="sticky bottom-0 p-6 pt-4 border-t border-[var(--color-border)] bg-[var(--color-background)] z-10 flex flex-col items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                {saving ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "Save Changes"}
              </button>
              
              {taskToEdit && (
                <button 
                  onClick={() => setDeleteTaskConfirm(true)}
                  className="text-sm font-semibold text-[#F87171] hover:text-red-400 transition-colors py-1"
                >
                  Delete Task
                </button>
              )}
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
