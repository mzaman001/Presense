"use client";

import { Toaster } from "sonner";

export function ToastProvider() {
  return (
    <Toaster 
      theme="dark" 
      position="bottom-right"
      style={{ zIndex: 9999 }}
      toastOptions={{
        style: {
          background: 'rgba(255, 255, 255, 0.055)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '0.5px solid rgba(255, 255, 255, 0.1)',
          color: '#FFFFFF',
          borderRadius: '16px',
        },
        className: 'font-sans',
      }}
    />
  );
}
