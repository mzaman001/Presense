import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserPlus, Loader2, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase";

import { toast } from "sonner";

interface AddPersonPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onPersonAdded?: () => void;
}

const COLORS = ["#E5B41E", "#FBBF24", "#F472B6", "#2DD4BF", "#4ADE80", "#F87171"];
const CATEGORIES = ["work", "study", "personal", "errand", "health", "other"];

export function AddPersonPanel({ isOpen, onClose, onPersonAdded }: AddPersonPanelProps) {
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("work");
  const [color, setColor] = useState(COLORS[0]);
  const [nextMeeting, setNextMeeting] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
          color,
          next_meeting: nextMeeting ? new Date(nextMeeting).toISOString() : null,
          notes: []
        });
        
        if (error) {
          console.error("Insert error:", error);
          setErrorMsg(error.message);
          toast.error("Failed to add person", { description: error.message });
          setSaving(false);
          return;
        }
        
        toast.success("Person added successfully");
        setName("");
        setRelationship("friend");
        setColor(COLORS[0]);
        setNextMeeting("");
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
            className="fixed top-0 right-0 h-full w-full max-w-md bg-[#13111C] border-l border-[rgba(255,255,255,0.1)] z-50 flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.05)]">
              <h2 className="text-lg font-semibold text-white">Add Person</h2>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-[rgba(255,255,255,0.1)] transition-colors">
                <X className="w-5 h-5 text-[rgba(255,255,255,0.5)]" />
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
                  className="w-full bg-transparent text-xl font-medium text-white placeholder:text-[rgba(255,255,255,0.2)] outline-none border-b border-transparent focus:border-[rgba(255,255,255,0.1)] pb-2 transition-colors"
                />
              </div>

              {/* Relationship */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-3">
                  Relationship
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((rel) => (
                    <button
                      key={rel}
                      onClick={() => setRelationship(rel)}
                      className={`px-3 py-1.5 rounded-full text-xs capitalize transition-all border ${
                        relationship === rel
                          ? "bg-white text-black border-white font-medium"
                          : "bg-transparent text-[rgba(255,255,255,0.5)] border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.3)]"
                      }`}
                    >
                      {rel}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-3">
                  Avatar Color
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
              <div className="bg-[rgba(255,255,255,0.02)] p-4 rounded-xl border border-[rgba(255,255,255,0.05)]">
                <label className="flex items-center justify-between text-xs font-semibold text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-3">
                  <span className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> Next Meeting (Optional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={nextMeeting}
                  onChange={(e) => setNextMeeting(e.target.value)}
                  className="w-full bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.1)] rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-[#F472B6] transition-colors [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="p-6 border-t border-[rgba(255,255,255,0.05)] bg-[#13111C]">
              {errorMsg && <p className="text-xs text-red-400 mb-3 text-center">{errorMsg}</p>}
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#F472B6] text-black font-semibold hover:bg-[#ec4899] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
