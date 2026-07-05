"use client";

import { Toaster } from "sonner";

import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { Icon as UiIcon } from "@/components/ui/Icon";

export function ToastProvider() {
  return (
    <Toaster 
      theme="system" 
      position="bottom-right"
      style={{ zIndex: 9999 }}
      toastOptions={{
        className: 'toast font-sans !text-[var(--text-1)]',
      }}
      icons={{
        success: <UiIcon size={16} strokeWidth={1.5} className="text-[var(--status-done)] shrink-0" icon={CheckCircle2} />,
        error: <UiIcon size={16} strokeWidth={1.5} className="text-[var(--status-danger)] shrink-0" icon={AlertCircle} />,
        info: <UiIcon size={16} strokeWidth={1.5} className="text-[var(--accent)] shrink-0" icon={Info} />,
      }}
    />
  );
}
