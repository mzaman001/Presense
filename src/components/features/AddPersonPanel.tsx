import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserPlus, Loader2, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { toast } from "sonner";
import { useAppStore } from "@/store/useAppStore";

interface AddPersonPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onPersonAdded?: () => void;
}

const COLORS = ['#E5B41E', '#7692FF', '#2DD4BF', '#F472B6', '#4ADE80', '#8B7CF8'];
export function AddPersonPanel({ isOpen, onClose, onPersonAdded }: AddPersonPanelProps) {
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("Friend");
  const [color, setColor] = useState<string | null>(null);
  const [nextMeeting, setNextMeeting] = useState("");
  const [firstNote, setFirstNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { userSettings } = useAppStore();
  const relationships = userSettings?.people_categories || ["friend", "family", "professor", "colleague", "teammate", "other"];

  // Ensure initial relationship is valid
  React.useEffect(() => {
    if (isOpen && !relationships.includes(relationship.toLowerCase())) {
      setRelationship(relationships[0] || "friend");
    }
  }, [isOpen, relationships]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { error } = await supabase.from("people").insert({
          user_id: user.id,
          name: name.trim(),
          relationship,
          ...(color ? { color } : {}),
          next_meeting: nextMeeting ? new Date(nextMeeting).toISOString() : null,
          notes: firstNote.trim() ? [{ text: firstNote.trim(), created_at: new Date().toISOString() }] : []
        });
        
        if (error) {
          console.error("Insert error:", error);
          setErrorMsg(error.message);
          toast.error("Failed to add person", { description: error.message });
          setSaving(false);
          return;
        }
        
        toast.success("Person added");
        setName("");
        setRelationship("Friend");
        setColor(null);
        setNextMeeting("");
        setFirstNote("");
        if (onPersonAdded) onPersonAdded();
        onClose();
      }
    } catch (err: any) {
      toast.error("Unexpected error", { description: err.message || "Could not add person" });
    } finally {
      setSaving(false);
    }
  };

  return (
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
            <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
              <h2 className="text-lg font-semibold text-[var(--color-text-1)]">Add Person</h2>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--color-surface)] transition-colors">
                <X className="w-5 h-5 text-[var(--color-text-3)]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Name */}
              <div>
                <input
                  autoFocus
                  placeholder="Person's name..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-transparent text-xl font-medium text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] outline-none border-b border-transparent focus:border-[var(--color-border)] pb-2 transition-colors"
                />
              </div>

              {/* Relationship */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-3">
                  Relationship
                </label>
                <div className="flex flex-wrap gap-2">
                  {relationships.map((rel: string) => (
                    <button
                      key={rel}
                      onClick={() => setRelationship(rel)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all capitalize ${
                        relationship.toLowerCase() === rel.toLowerCase()
                          ? "bg-[#F472B6] text-[var(--color-background)] border-[#F472B6]"
                          : "bg-transparent text-[var(--color-text-3)] border-[var(--color-border)] hover:border-[var(--color-border)]"
                      }`}
                    >
                      {rel}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="flex items-center justify-between text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-3">
                  <span>Avatar Color</span>
                  {color && (
                    <button onClick={() => setColor(null)} className="text-[10px] text-[var(--color-text-3)] hover:text-[var(--color-text-1)] capitalize transition-colors">
                      Clear
                    </button>
                  )}
                </label>
                <div className="flex gap-3">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className="w-8 h-8 rounded-full border-2 transition-all"
                      style={{ 
                        backgroundColor: c, 
                        borderColor: color === c ? "white" : "transparent",
                        transform: color === c ? "scale(1.1)" : "scale(1)"
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Next Meeting */}
              <div className="bg-[var(--color-surface)] p-4 rounded-xl border border-[var(--color-border)]">
                <label className="flex items-center justify-between text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-3">
                  <span className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> Next Meeting (Optional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={nextMeeting}
                  onChange={(e) => setNextMeeting(e.target.value)}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3 text-sm text-[var(--color-text-1)] outline-none focus:border-[#F472B6] transition-colors [color-scheme:dark]"
                />
              </div>

              {/* First Note */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-3)] uppercase tracking-wider mb-3">
                  First Note (Optional)
                </label>
                <textarea
                  placeholder="What do you want to remember about them?"
                  value={firstNote}
                  onChange={(e) => setFirstNote(e.target.value)}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-sm text-[var(--color-text-1)] placeholder:text-[var(--color-text-3)] outline-none focus:border-[#F472B6] transition-colors resize-none h-24"
                />
              </div>
            </div>

            <div className="p-6 border-t border-[var(--color-border)] bg-[var(--color-background)]">
              {errorMsg && <p className="text-xs text-red-400 mb-3 text-center">{errorMsg}</p>}
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#F472B6] text-[var(--color-background)] font-semibold hover:bg-[#ec4899] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><UserPlus className="w-4 h-4" /> Add Person</>}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
