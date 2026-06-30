import React from "react";
import { m, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmDestructive?: boolean;
  inputRequired?: string;
  onConfirm: () => void | Promise<void>;
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
  const [isConfirming, setIsConfirming] = React.useState(false);

  // Reset state when modal opens — intentional sync initialization
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    if (isOpen) {
      setInputValue("");
      setIsConfirming(false);
    }
  }, [isOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const isConfirmDisabled = inputRequired ? inputValue !== inputRequired : false;

  const handleConfirm = async () => {
    if (isConfirmDisabled || isConfirming) return;
    setIsConfirming(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // Keep modal open on error so user can retry
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={isConfirming ? undefined : onClose}
          />
          <m.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 280, damping: 26, duration: 0.22 }}
            className="modal relative w-full max-w-md p-6"
          >
            {!isConfirming && (
              <button
                onClick={onClose}
                className="btn-icon absolute top-4 right-4"
              >
                <X size={16} strokeWidth={1.5} className="shrink-0" />
              </button>
            )}
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
                  disabled={isConfirming}
                  className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-1)] focus:border-[var(--color-accent)] focus:outline-none transition-colors disabled:opacity-50"
                />
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                disabled={isConfirming}
                className="btn-secondary disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={isConfirmDisabled || isConfirming}
                onClick={handleConfirm}
                className={cn(
                  confirmDestructive ? "btn-danger" : "btn-primary",
                  "disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                )}
              >
                {isConfirming && <Loader2 size={14} className="animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </m.div>
        </div>
      )}
    </AnimatePresence>
  );
}
