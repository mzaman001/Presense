import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { GlassCard } from "@/components/ui/GlassCard";
import { Check, Clock, Play, Timer } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn, formatRRule } from "@/lib/utils";
import { DEFAULT_DO_COLORS } from "@/lib/constants";

function formatDeadline(d: string | null) {
  if (!d) return null;
  const date = new Date(d);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === date.toDateString();
  if (date < now && !isToday) return "Overdue";
  if (isToday) return "Today";
  if (isTomorrow) return "Tomorrow";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}



function formatTimeSpent(minutes: number | undefined | null) {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export const TaskCard = React.memo(({
  task,
  completing,
  completeTask,
  openEditPanel,
  fetchTasks,
  peopleMap
}: {
  task: any;
  completing: string | null;
  completeTask: (e: React.MouseEvent, id: string) => void;
  openEditPanel: (task: any) => void;
  fetchTasks: () => void;
  peopleMap?: Record<string, { initials: string, color: string, name: string }>;
}) => {
  const userSettings = useAppStore(s => s.userSettings);
  const setActiveTimer = useAppStore(s => s.setActiveTimer);
  const markMutation = useAppStore(s => s.markMutation);
  const supabase = useMemo(() => createClient(), []);

  const label = formatDeadline(task.deadline);
  const isOverdue = label === "Overdue";
  const subtasks: {completed: boolean}[] = task.subtasks || [];
  const completedSubtasks = subtasks.filter(st => st.completed).length;
  const priority = task.priority || 4;

  const priorityDotColor =
    priority === 1 ? "var(--space-do)" :
    priority === 2 ? "var(--accent)" :
    priority === 3 ? "var(--space-think)" :
    "var(--text-4)";

  const priorityGlow = priority === 1 ? "0 0 6px var(--space-do)" : "none";

  const isCompleting = completing === task.id;

  return (
    <motion.div
      layout
      layoutId={task.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{
        opacity: isCompleting ? 0.6 : 1,
        y: 0,
        scale: isCompleting ? 0.98 : 1,
        filter: isCompleting ? "blur(1px)" : "blur(0px)",
      }}
      exit={{
        opacity: 0,
        scale: 0.95,
        x: -20,
        filter: "blur(4px)",
        transition: { duration: 0.3, ease: [0.4, 0, 1, 1] },
      }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group relative"
    >
      <GlassCard
        onClick={() => openEditPanel(task)}
        className={cn(
          "p-4 group cursor-pointer transition-all relative",
          isOverdue && "border-[rgba(248,113,113,0.3)]",
          isCompleting && "border-[rgba(74,222,128,0.4)] bg-[rgba(74,222,128,0.06)]"
        )}
      >
        {priority < 4 && (
          <div
            className="absolute top-2 right-2 w-2 h-2 rounded-full"
            style={{ background: priorityDotColor, boxShadow: priorityGlow }}
          />
        )}

        <div className="flex items-start gap-3">
          <motion.button
            onClick={(e) => completeTask(e, task.id)}
            animate={isCompleting ? {
              scale: [1, 1.2, 1],
              backgroundColor: "rgba(74,222,128,1)",
            } : {}}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={cn(
              "checkbox mt-0.5 shrink-0",
              isCompleting && "checked"
            )}
          >
            {isCompleting && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
          </motion.button>

          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              {isOverdue && (
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--space-do)" }}>Overdue</span>
              )}
              {!isOverdue && label === "Today" && (
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--status-today)" }}>Due Today</span>
              )}
              <span
                className="text-[10px] font-semibold capitalize"
                style={{ color: (userSettings?.do_category_colors?.[task.category] || DEFAULT_DO_COLORS[task.category]) ?? "var(--text-4)" }}
              >
                {task.category}
              </span>
            </div>

            <motion.p
              className="text-[14px] font-semibold leading-snug"
              style={{ color: "var(--text-1)" }}
              animate={isCompleting ? {
                textDecoration: "line-through",
                textDecorationColor: "rgba(74,222,128,0.7)",
                color: "var(--text-3)",
              } : {}}
              transition={{ duration: 0.25 }}
            >
              {task.title}
            </motion.p>

            {task.first_step && (
              <p className="text-[12px] mt-1" style={{ color: isOverdue ? "var(--space-do)" : "var(--space-think)" }}>
                → {task.first_step}
              </p>
            )}

            {task.recurrence && (
              <p className="text-[12px] mt-1" style={{ color: "var(--text-3)" }}>
                ↻ {formatRRule(task.recurrence)}
              </p>
            )}

            {subtasks.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-1)" }}>
                  <div
                    className="h-full transition-all"
                    style={{ width: `${(completedSubtasks / subtasks.length) * 100}%`, background: "var(--text-3)" }}
                  />
                </div>
                <span className="text-[10px] font-medium shrink-0" style={{ color: "var(--text-3)" }}>
                  {completedSubtasks}/{subtasks.length}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: "0.5px solid var(--border-subtle)" }}>
          <div className="flex items-center gap-3">
            <span className="text-[12px]" style={{ color: "var(--text-3)" }}>
              {label && label !== "Overdue" && label !== "Today" ? label : task.deadline ? "" : "No deadline"}
            </span>

            {/* Linked People Avatars */}
            {peopleMap && task.linked_people_ids && task.linked_people_ids.length > 0 && (
              <div className="flex -space-x-1.5" title={task.linked_people_ids.map((id: string) => peopleMap[id]?.name).filter(Boolean).join(', ')}>
                {task.linked_people_ids.map((id: string, index: number) => {
                  const person = peopleMap[id];
                  if (!person) return null;
                  return (
                    <div
                      key={id}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white border-2 border-[var(--color-bg-elevated)]"
                      style={{ backgroundColor: person.color, zIndex: 10 - index }}
                    >
                      {person.initials || person.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {task.time_spent_minutes > 0 && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md" style={{ background: "rgba(229,180,30,0.08)" }} title="Time spent on this task">
                <Timer size={12} strokeWidth={1.5} style={{ color: "var(--accent)" }} />
                <span className="text-[10px] font-bold" style={{ color: "var(--accent)" }}>{formatTimeSpent(task.time_spent_minutes)}</span>
              </div>
            )}
            {(task.snoozed_until && new Date(task.snoozed_until) > new Date()) && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-md" style={{ background: "var(--surface-1)", border: "0.5px solid var(--border-default)" }}>
                <Clock size={12} strokeWidth={1.5} style={{ color: "var(--text-3)" }} />
                <span className="text-[10px]" style={{ color: "var(--text-3)" }}>
                  {new Date(task.snoozed_until).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </span>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    markMutation();
                    await supabase.from('items').update({ snoozed_until: null }).eq('id', task.id);
                    fetchTasks();
                  }}
                  className="ml-1"
                  style={{ color: "var(--text-3)" }}
                >
                  ×
                </button>
              </div>
            )}

            <button
              onClick={(e) => { e.stopPropagation(); setActiveTimer({ taskId: task.id, taskTitle: task.title }); }}
              className="btn-icon"
              style={{
                background: "rgba(229,180,30,0.08)",
                color: "var(--accent)",
                border: "none",
              }}
              title="Start focus session"
            >
              <Play size={14} strokeWidth={0} className="fill-current" />
            </button>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  if (prevProps.completing !== nextProps.completing) return false;
  if (prevProps.peopleMap !== nextProps.peopleMap) return false;
  return JSON.stringify(prevProps.task) === JSON.stringify(nextProps.task);
});

TaskCard.displayName = "TaskCard";
