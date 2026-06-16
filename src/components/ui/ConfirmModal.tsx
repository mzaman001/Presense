import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmDestructive?: boolean;
  inputRequired?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel,
  confirmDestructive = false,
  inputRequired,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const [inputValue, setInputValue] = React.useState("");

  React.useEffect(() => {
    if (isOpen) setInputValue("");
  }, [isOpen]);

  const isConfirmDisabled = inputRequired ? inputValue !== inputRequired : false;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 280, damping: 26, duration: 0.22 }}
            className="modal relative w-full max-w-md p-6"
          >
            <button
              onClick={onClose}
              className="btn-icon absolute top-4 right-4"
            >
              <X size={16} strokeWidth={1.5} className="shrink-0" />
            </button>
            <div className="mb-6 pr-8">
              <h2 className="text-[var(--color-text-1)] font-semibold text-lg mb-2">{title}</h2>
              <p className="text-[var(--color-text-2)] text-sm">{description}</p>
            </div>
            {inputRequired && (
              <div className="mb-6">
                <label className="block text-xs font-semibold text-[var(--color-text-3)] mb-2">
                  Type <span className="text-[var(--color-text-1)] font-bold">{inputRequired}</span> to confirm
                </label>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={inputRequired}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-1)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
                />
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                disabled={isConfirmDisabled}
                onClick={() => {
                  if (!isConfirmDisabled) {
                    onConfirm();
                    onClose();
                  }
                }}
                className={cn(
                  confirmDestructive ? "btn-danger" : "btn-primary",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
