import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, ArrowRight, Flag, Loader2, RotateCw, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "sonner";
import nlp from "compromise";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import datePlugin from "compromise-dates";
nlp.plugin(datePlugin as any);

interface TaskAddPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskAdded?: () => void;
  taskToEdit?: any; // To support edit mode
}

const CATEGORIES = ["work", "study", "personal", "errand", "health"];

export function TaskAddPanel({ isOpen, onClose, onTaskAdded, taskToEdit }: TaskAddPanelProps) {
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [deadlineText, setDeadlineText] = useState("");
  const [parsedDeadline, setParsedDeadline] = useState<Date | null>(null);
  const [startDate, setStartDate] = useState("");
  const [parsedStartDate, setParsedStartDate] = useState<Date | null>(null);
  const [recurrence, setRecurrence] = useState("");
  const [freq, setFreq] = useState("None");
  const [days, setDays] = useState<string[]>([]);
  const [firstStep, setFirstStep] = useState("");
  const [ifThen, setIfThen] = useState("");
  const [category, setCategory] = useState("work");
  const [priority, setPriority] = useState(4);
  const [subtasks, setSubtasks] = useState<{title: string; completed: boolean}[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteTaskConfirm, setDeleteTaskConfirm] = useState(false);

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

  React.useEffect(() => {
    if (isOpen) {
      if (taskToEdit) {
        setTitle(taskToEdit.title || "");
        setFirstStep(taskToEdit.first_step || "");
        setIfThen(taskToEdit.ifthen_trigger || "");
        setCategory(taskToEdit.category || "work");
        setPriority(taskToEdit.priority || 4);
        setSubtasks(taskToEdit.subtasks || []);
        setRecurrence(taskToEdit.recurrence || "");
        if (taskToEdit.recurrence) {
          if (taskToEdit.recurrence.includes("DAILY")) setFreq("Daily");
          else if (taskToEdit.recurrence.includes("MONTHLY")) setFreq("Monthly");
          else if (taskToEdit.recurrence.includes("WEEKLY")) {
            setFreq("Weekly");
            const match = taskToEdit.recurrence.match(/BYDAY=([A-Z,]+)/);
            if (match) setDays(match[1].split(','));
          } else setFreq("None");
        } else setFreq("None");
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
        setDeadlineText("");
        setParsedDeadline(null);
        setStartDate("");
        setParsedStartDate(null);
        setRecurrence("");
        setFreq("None");
        setDays([]);
        setFirstStep("");
        setIfThen("");
        setCategory("work");
        setPriority(4);
        setSubtasks([]);
      }
      setErrorMsg(null);
    }
  }, [isOpen, taskToEdit]);

  // Parse natural language dates when title or deadline changes
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (!deadline && !deadlineText) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = nlp(val) as any;
      const dates = doc.dates().json();
      if (dates && dates.length > 0 && dates[0].dates && dates[0].dates.start) {
        setParsedDeadline(new Date(dates[0].dates.start));
      } else {
        setParsedDeadline(null);
      }
    }
  };

  const handleDeadlineTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDeadlineText(val);
    if (val.trim()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = nlp(val) as any;
      const dates = doc.dates().json();
      if (dates && dates.length > 0 && dates[0].dates && dates[0].dates.start) {
        const d = new Date(dates[0].dates.start);
        setParsedDeadline(d);
        setDeadline(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
      } else {
        setParsedDeadline(null);
        setDeadline("");
      }
    } else {
      setParsedDeadline(null);
      setDeadline("");
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
        // Only wrap if it doesn't already have the format (prevents double wrapping on edit)
        if (triggerText && !triggerText.startsWith("When ")) {
          triggerText = `When ${triggerText}, I will ${firstStep.trim()}`;
        }

        let finalRecurrence = null;
        if (freq === "Daily") finalRecurrence = "FREQ=DAILY";
        else if (freq === "Monthly") finalRecurrence = "FREQ=MONTHLY";
        else if (freq === "Weekly") {
          finalRecurrence = "FREQ=WEEKLY";
          if (days.length > 0) finalRecurrence += `;BYDAY=${days.join(',')}`;
        }

        let finalTitle = title.trim();
        if (!deadline && !deadlineText && parsedDeadline) {
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
          priority,
          subtasks
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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          
          {/* Slide-in Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-[#13111C] border-l border-[rgba(255,255,255,0.1)] z-50 flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.05)]">
              <h2 className="text-lg font-semibold text-white">{taskToEdit ? "Edit Task" : "Add Task"}</h2>
              <div className="flex items-center gap-2">
                {taskToEdit && (
                  <button onClick={() => setDeleteTaskConfirm(true)} className="p-2 rounded-full hover:bg-[rgba(248,113,113,0.1)] text-[rgba(255,255,255,0.5)] hover:text-[#F87171] transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button onClick={onClose} className="p-2 rounded-full hover:bg-[rgba(255,255,255,0.1)] transition-colors">
                  <X className="w-5 h-5 text-[rgba(255,255,255,0.5)]" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Title */}
              <div>
                <div className="relative">
                  <input
                    autoFocus
                    placeholder="Task title (e.g. Finish the OS assignment...)"
                    value={title}
                    onChange={handleTitleChange}
                    className="w-full bg-transparent text-xl font-medium text-white placeholder:text-[rgba(255,255,255,0.2)] outline-none border-b border-transparent focus:border-[rgba(255,255,255,0.1)] pb-2 transition-colors"
                  />
                  {parsedDeadline && !deadlineText && (
                    <div className="absolute right-0 bottom-2 text-xs text-[#4ADE80] font-medium bg-[rgba(74,222,128,0.1)] border border-[rgba(74,222,128,0.2)] px-2 py-1 rounded-md flex items-center gap-1 shadow-lg shadow-[rgba(74,222,128,0.05)]">
                      <Calendar className="w-3 h-3" />
                      NLP: {parsedDeadline.toLocaleDateString("en-US", { weekday: "short", hour: "numeric" })}
                    </div>
                  )}
                </div>
              </div>

              {/* Deadline & Start Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[rgba(255,255,255,0.02)] p-4 rounded-xl border border-[rgba(255,255,255,0.05)]">
                  <label className="flex items-center justify-between text-xs font-semibold text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-3">
                    <span className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> Deadline</span>
                  </label>
                  <div className="relative space-y-3">
                    <input
                      placeholder="e.g. next Friday"
                      value={deadlineText}
                      onChange={handleDeadlineTextChange}
                      className="w-full bg-transparent border-b border-[rgba(255,255,255,0.1)] pb-2 text-sm text-white placeholder:text-[rgba(255,255,255,0.25)] outline-none focus:border-[var(--color-accent)] transition-colors"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[rgba(255,255,255,0.3)] uppercase">Exact:</span>
                      <input
                        type="datetime-local"
                        value={deadline || ""}
                        onChange={handleManualDateChange}
                        className="flex-1 bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-accent)] transition-colors [color-scheme:dark]"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-[rgba(255,255,255,0.02)] p-4 rounded-xl border border-[rgba(255,255,255,0.05)]">
                  <label className="flex items-center gap-2 text-xs font-semibold text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-3">
                    <Calendar className="w-3.5 h-3.5" /> Start Date
                  </label>
                  <p className="text-[10px] text-[rgba(255,255,255,0.3)] mb-2 leading-tight">Hide from active lists until this date.</p>
                  <input
                    type="datetime-local"
                    value={startDate || ""}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setParsedStartDate(e.target.value ? new Date(e.target.value) : null);
                    }}
                    className="w-full bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-accent)] transition-colors [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* Recurrence */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-2">
                  <RotateCw className="w-3.5 h-3.5 text-[#E5B41E]" /> Recurrence
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {["None", "Daily", "Weekly", "Monthly"].map(f => (
                    <button
                      key={f}
                      onClick={() => setFreq(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${freq === f ? 'bg-[rgba(229,180,30,0.15)] text-[#E5B41E] border-[rgba(229,180,30,0.3)]' : 'bg-transparent text-[rgba(255,255,255,0.4)] border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)] hover:text-white'}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                {freq === "Weekly" && (
                  <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.05)]">
                    {[
                      { l: 'M', v: 'MO' }, { l: 'T', v: 'TU' }, { l: 'W', v: 'WE' }, 
                      { l: 'T', v: 'TH' }, { l: 'F', v: 'FR' }, { l: 'S', v: 'SA' }, { l: 'S', v: 'SU' }
                    ].map((d, i) => (
                      <button
                        key={`${d.v}-${i}`}
                        onClick={() => setDays(prev => prev.includes(d.v) ? prev.filter(x => x !== d.v) : [...prev, d.v])}
                        className={`w-8 h-8 rounded-full text-xs font-bold transition-colors ${days.includes(d.v) ? 'bg-[#E5B41E] text-black' : 'bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.4)] hover:bg-[rgba(255,255,255,0.1)] hover:text-white'}`}
                      >
                        {d.l}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* First Step */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-2">
                  <ArrowRight className="w-3.5 h-3.5 text-[#2DD4BF]" /> First Step (optional)
                </label>
                <p className="text-[11px] text-[rgba(255,255,255,0.3)] mb-2">What is the absolute smallest step to start this?</p>
                <textarea
                  placeholder="e.g. Open Chapter 3 to page 47"
                  value={firstStep}
                  onChange={(e) => setFirstStep(e.target.value)}
                  className="w-full bg-[rgba(45,212,191,0.05)] border border-[rgba(45,212,191,0.2)] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[rgba(45,212,191,0.3)] outline-none focus:border-[#2DD4BF] resize-none h-20 transition-colors"
                />
              </div>

              {/* If-Then Trigger */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-2">
                  <Flag className="w-3.5 h-3.5 text-[#F472B6]" /> When and where will you start this?
                </label>
                <p className="text-[11px] text-[rgba(255,255,255,0.3)] mb-2">When and where will you start this?</p>
                <div className="bg-[rgba(244,114,182,0.05)] border border-[rgba(244,114,182,0.2)] rounded-xl p-4">
                  <div className="flex items-center gap-2 text-sm text-white mb-2">
                    <span className="font-bold text-[#F472B6]">When</span>
                    <input
                      placeholder="I sit at my desk after dinner"
                      value={ifThen}
                      onChange={(e) => setIfThen(e.target.value)}
                      className="flex-1 bg-transparent border-b border-[rgba(244,114,182,0.3)] focus:border-[#F472B6] outline-none text-white placeholder:text-[rgba(244,114,182,0.4)] pb-0.5"
                    />
                  </div>
                  <div className="flex items-start gap-2 text-sm text-white opacity-60">
                    <span className="font-bold">I will</span>
                    <span className="line-clamp-2">{firstStep || "..."}</span>
                  </div>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-3">
                  Category
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs capitalize transition-all border ${
                        category === cat
                          ? "bg-white text-black border-white font-medium"
                          : "bg-transparent text-[rgba(255,255,255,0.5)] border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.3)]"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              {/* Priority */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-3">
                  Priority
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                        priority === p
                          ? p === 1 ? "bg-[rgba(248,113,113,0.2)] text-[#F87171] border-[rgba(248,113,113,0.5)]"
                          : p === 2 ? "bg-[rgba(251,191,36,0.2)] text-[#FBBF24] border-[rgba(251,191,36,0.5)]"
                          : p === 3 ? "bg-[rgba(45,212,191,0.2)] text-[#2DD4BF] border-[rgba(45,212,191,0.5)]"
                          : "bg-white text-black border-white"
                          : "bg-transparent text-[rgba(255,255,255,0.5)] border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.3)]"
                      }`}
                    >
                      P{p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subtasks */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-2">
                  Subtasks
                </label>
                <div className="space-y-2 mb-2">
                  {subtasks.map((st, idx) => (
                    <div key={idx} className="flex items-center gap-2 group">
                      <button
                        onClick={() => {
                          const newSt = [...subtasks];
                          newSt[idx].completed = !newSt[idx].completed;
                          setSubtasks(newSt);
                        }}
                        className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${st.completed ? "bg-[#2DD4BF] border-[#2DD4BF]" : "border-[rgba(255,255,255,0.3)]"}`}
                      >
                        {st.completed && <X className="w-3 h-3 text-black" />}
                      </button>
                      <input
                        value={st.title}
                        onChange={(e) => {
                          const newSt = [...subtasks];
                          newSt[idx].title = e.target.value;
                          setSubtasks(newSt);
                        }}
                        placeholder="New subtask..."
                        className={`flex-1 bg-transparent text-sm outline-none border-b border-transparent focus:border-[rgba(255,255,255,0.2)] transition-colors ${st.completed ? "text-[rgba(255,255,255,0.3)] line-through" : "text-white"}`}
                      />
                      <button
                        onClick={() => {
                          const newSt = [...subtasks];
                          newSt.splice(idx, 1);
                          setSubtasks(newSt);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[rgba(255,255,255,0.3)] hover:text-[#F87171] transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setSubtasks([...subtasks, { title: "", completed: false }])}
                  className="text-xs font-medium text-[rgba(255,255,255,0.5)] hover:text-white flex items-center gap-1 transition-colors mt-2"
                >
                  + Add subtask
                </button>
              </div>
            </div>

            <div className="p-6 border-t border-[rgba(255,255,255,0.05)] bg-[#13111C]">
              <button
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : taskToEdit ? "Save Changes" : "Save Task"}
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
      confirmVariant="danger"
    />
    </>
  );
}
