import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { toast } from "sonner";

interface LocationAddPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationAdded?: () => void;
  itemToEdit?: any; // To support edit mode
  initialName?: string;
}

export function LocationAddPanel({ isOpen, onClose, onLocationAdded, itemToEdit, initialName }: LocationAddPanelProps) {
  const [itemName, setItemName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (itemToEdit) {
        setItemName(itemToEdit.item_name || "");
        setLocationText(itemToEdit.location_text || "");
      } else {
        setItemName(initialName || "");
        setLocationText("");
      }
      setErrorMsg(null);
    }
  }, [isOpen, itemToEdit, initialName]);

  const handleSave = async () => {
    if (!itemName.trim() || !locationText.trim()) return;
    setSaving(true);
    setErrorMsg(null);
    
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        if (itemToEdit) {
          const { error } = await supabase.from("locations").update({
            item_name: itemName.trim(),
            location_text: locationText.trim(),
            updated_at: new Date().toISOString()
          }).eq("id", itemToEdit.id);
          
          if (error) throw error;
          toast.success("Location updated");
        } else {
          const { error } = await supabase.from("locations").insert({
            user_id: user.id,
            item_name: itemName.trim(),
            location_text: locationText.trim(),
          });
          
          if (error) throw error;
          toast.success("Location logged");
        }
        
        if (onLocationAdded) onLocationAdded();
        onClose();
      }
    } catch (err: any) {
      console.error("Save error:", err);
      setErrorMsg(err.message);
      toast.error(itemToEdit ? "Failed to update location" : "Failed to log location", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!itemToEdit) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("locations").delete().eq("id", itemToEdit.id);
      if (error) throw error;
      toast.success("Location deleted");
      if (onLocationAdded) onLocationAdded();
      onClose();
    } catch (err: any) {
      toast.error("Failed to delete location", { description: err.message });
    } finally {
      setDeleteConfirm(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%", opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-[100dvh] w-full md:w-[420px] bg-[var(--color-surface)] border-l border-[var(--color-border)] z-50 flex flex-col shadow-2xl"
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[rgba(255,255,255,0.02)]">
              <h2 className="text-lg font-bold text-[var(--color-text-1)]">{itemToEdit ? "Edit Location" : "Log Location"}</h2>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-[rgba(255,255,255,0.1)] transition-colors">
                <X className="w-5 h-5 text-[var(--color-text-2)]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {errorMsg}
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-3)] mb-2 uppercase tracking-wider">
                    Item Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="e.g. Keys, Passport, Charger"
                    className="w-full bg-[rgba(255,255,255,0.03)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-1)] focus:border-[#4ADE80] focus:outline-none transition-colors placeholder:text-[var(--color-text-3)]/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--color-text-3)] mb-2 uppercase tracking-wider">
                    Location <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={locationText}
                    onChange={(e) => setLocationText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                    placeholder="e.g. In the top drawer of my desk"
                    className="w-full bg-[rgba(255,255,255,0.03)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-1)] focus:border-[#4ADE80] focus:outline-none transition-colors placeholder:text-[var(--color-text-3)]/50"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] flex gap-3">
              {itemToEdit && (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-400 font-semibold hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !itemName.trim() || !locationText.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#4ADE80] text-[var(--color-background)] font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(74,222,128,0.3)] disabled:shadow-none"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : (itemToEdit ? "Save Changes" : "Log Location")}
              </button>
            </div>
          </motion.div>
        </>
      )}
      
      <ConfirmModal
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Location"
        message={`Are you sure you want to delete "${itemToEdit?.item_name}"?`}
        confirmText="Delete Location"
        isDanger={true}
      />
    </AnimatePresence>
  );
}
