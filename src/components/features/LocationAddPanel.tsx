import { logger } from "@/lib/logger";
import React, { useState, useEffect } from "react";
import { m, AnimatePresence } from "framer-motion";
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
      logger.error("Save error:", err);
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
    <>
      <AnimatePresence>
        {isOpen && (
          <m.div 
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed -inset-[100px] bg-black/60 backdrop-blur-sm z-40 transform-gpu"
            onClick={onClose}
          />
        )}
        {isOpen && (
          <m.div
            key="panel"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed top-0 right-0 h-[100dvh] w-full md:top-3 md:right-3 md:h-[calc(100dvh-24px)] md:w-[420px] md:rounded-2xl bg-[var(--color-surface)] backdrop-blur-2xl border-l md:border border-[var(--color-border)] z-50 flex flex-col shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] md:rounded-t-2xl">
              <h2 className="text-lg font-bold text-[var(--color-text-1)]">{itemToEdit ? "Edit Location" : "Log Location"}</h2>
              <button onClick={onClose} className="btn-icon">
                <X size={16} strokeWidth={1.5} className="shrink-0" />
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
                  <label className="text-label text-[var(--text-3)] block mb-2">
                    Item Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSave();
                    }}
                    placeholder="e.g. Keys, Passport, Charger"
                    className="input"
                  />
                </div>

                <div>
                  <label className="text-label text-[var(--text-3)] block mb-2">
                    Location <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={locationText}
                    onChange={(e) => setLocationText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                    placeholder="e.g. In the top drawer of my desk"
                    className="input"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] flex gap-3 md:rounded-b-2xl">
              {itemToEdit && (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="btn-danger px-3 flex items-center justify-center"
                >
                  <Trash2 size={14} strokeWidth={1.5} className="shrink-0" />
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving || !itemName.trim() || !locationText.trim()}
                className="flex-1 btn-primary py-3 w-full disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin shrink-0" /> : (itemToEdit ? "Save Changes" : "Log Location")}
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
      <ConfirmModal
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Location"
        description={`Are you sure you want to delete "${itemToEdit?.item_name}"?`}
        confirmLabel="Delete Location"
        confirmDestructive={true}
      />
    </>
  );
}

