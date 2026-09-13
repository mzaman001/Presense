import React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Icon as UiIcon } from "@/components/ui/Icon";

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

  const isConfirmDisabled = inputRequired
    ? inputValue !== inputRequired
    : false;

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
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && !isConfirming && onClose()}
    >
      <DialogContent showClose={!isConfirming}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {inputRequired && (
          <div className="mb-6">
            <label className="mb-2 block text-xs font-semibold text-[var(--text-3)]">
              Type{" "}
              <span className="font-bold text-[var(--text-1)]">
                {inputRequired}
              </span>{" "}
              to confirm
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={inputRequired}
              disabled={isConfirming}
              className="input"
            />
          </div>
        )}
        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isConfirming}>
            Cancel
          </Button>
          <Button
            variant={confirmDestructive ? "danger" : "primary"}
            disabled={isConfirmDisabled || isConfirming}
            onClick={handleConfirm}
            className="inline-flex items-center gap-2"
          >
            {isConfirming && (
              <UiIcon size={14} className="animate-spin" icon={Loader2} />
            )}
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
