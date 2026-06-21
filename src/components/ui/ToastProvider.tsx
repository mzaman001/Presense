"use client";

import { Toaster } from "sonner";

import { CheckCircle2, AlertCircle, Info } from "lucide-react";

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
        success: <CheckCircle2 size={16} strokeWidth={1.5} className="text-[var(--status-done)] shrink-0" />,
        error: <AlertCircle size={16} strokeWidth={1.5} className="text-[var(--status-danger)] shrink-0" />,
        info: <Info size={16} strokeWidth={1.5} className="text-[var(--accent)] shrink-0" />,
      }}
    />
  );
}
