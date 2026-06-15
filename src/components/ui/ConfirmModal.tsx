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
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", duration: 0.3, bounce: 0.2 }}
            className="relative w-full max-w-md bg-[#13111C] border border-[rgba(255,255,255,0.1)] rounded-2xl shadow-2xl p-6"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.4)] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="mb-6 pr-8">
              <h2 className="text-white font-semibold text-lg mb-2">{title}</h2>
              <p className="text-[var(--color-text-2)] text-sm">{description}</p>
            </div>
            {inputRequired && (
              <div className="mb-6">
                <label className="block text-xs font-semibold text-[rgba(255,255,255,0.5)] mb-2">
                  Type <span className="text-white font-bold">{inputRequired}</span> to confirm
                </label>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={inputRequired}
                  className="w-full bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-white focus:border-[var(--color-accent)] focus:outline-none transition-colors"
                />
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--color-text-2)] hover:text-white hover:bg-[rgba(255,255,255,0.05)] transition-colors"
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
                  "px-5 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                  confirmDestructive
                    ? "bg-[#F87171]/10 text-[#F87171] border border-[#F87171]/20 hover:bg-[#F87171]/20"
                    : "bg-[var(--color-accent)] text-black hover:bg-[var(--color-accent)]/90"
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
