"use client";

import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster 
      theme="system" 
      position="bottom-right"
      style={{ zIndex: 9999 }}
      toastOptions={{
        style: {
          background: 'var(--color-surface)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '0.5px solid var(--color-border)',
          color: 'var(--color-text-1)',
          borderRadius: '16px',
        },
        className: 'font-sans',
      }}
    />
  );
}
