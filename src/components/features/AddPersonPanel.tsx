"use client";
import { logger } from "@/lib/logger";
import React, { useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { m, AnimatePresence } from "framer-motion";
import { X, UserPlus, Loader2, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { toast } from "sonner";
import { useAppStore } from "@/store/useAppStore";

interface AddPersonPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onPersonAdded?: () => void;
}

import { RELATIONSHIP_COLORS } from "@/lib/constants";

const COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#64748B'  // Slate
];
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
          logger.error("Insert error:", error);
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
            className="fixed top-0 right-0 h-[100dvh] w-full md:top-3 md:right-3 md:h-[calc(100dvh-24px)] md:w-[420px] md:rounded-2xl bg-[var(--color-surface)] backdrop-blur-2xl border-l md:border border-[var(--color-border)] z-50 flex flex-col shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] md:rounded-t-2xl">
              <h2 className="text-lg font-bold text-[var(--color-text-1)]">Add Person</h2>
              <button onClick={onClose} className="btn-icon">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Name */}
              <div>
                <label className="text-label text-[var(--text-3)] block mb-2">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  autoFocus
                  placeholder="Person's name..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                  }}
                  className="input"
                />
              </div>

              {/* Relationship */}
              <div>
                <label className="flex items-center gap-2 text-label text-[var(--text-3)] mb-3">
                  Relationship
                </label>
                <div className="flex flex-wrap gap-2">
                  {relationships.map((rel: string) => {
                    const cColor = RELATIONSHIP_COLORS[rel] || "var(--color-text-3)";
                    const isActive = relationship.toLowerCase() === rel.toLowerCase();
                    return (
                      <button
                        key={rel}
                        onClick={() => setRelationship(isActive ? "" : rel)}
                        style={{
                          borderColor: isActive ? cColor : `${cColor}40`,
                          backgroundColor: isActive ? `${cColor}20` : "transparent",
                          color: isActive ? cColor : "var(--color-text-3)"
                        }}
                        className={`px-4 py-2 rounded-xl text-sm capitalize transition-all border ${
                          isActive ? "font-semibold shadow-sm" : "hover:bg-[var(--color-surface)]"
                        }`}
                      >
                        {rel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="flex items-center justify-between text-label text-[var(--text-3)] mb-3">
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
              <div className="bg-[rgba(255,255,255,0.03)] p-4 rounded-xl border border-[var(--color-border)]">
                <label className="flex items-center justify-between text-label text-[var(--text-3)] mb-3">
                  <span className="flex items-center gap-2"><Calendar size={13} strokeWidth={1.5} className="text-[var(--text-3)]" /> Next Meeting (Optional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={nextMeeting}
                  onChange={(e) => setNextMeeting(e.target.value)}
                  className="input"
                />
              </div>

              {/* First Note */}
              <div>
                <label className="flex items-center gap-2 text-label text-[var(--text-3)] mb-3">
                  First Note (Optional)
                </label>
                <TextareaAutosize
                  placeholder="What do you want to remember about them?"
                  value={firstNote}
                  onChange={(e) => setFirstNote(e.target.value)}
                  minRows={2}
                  className="input resize-none"
                />
              </div>
            </div>

            <div className="p-4 border-t border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] flex gap-3 md:rounded-b-2xl">
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="flex-1 btn-primary py-3 w-full disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
              </button>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}

