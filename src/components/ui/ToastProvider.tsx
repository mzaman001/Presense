"use client";

import { useState, useEffect } from "react";
import { Toaster } from "sonner";

import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { Icon as UiIcon } from "@/components/ui/Icon";

export function ToastProvider() {
  const [mode, setMode] = useState<"light" | "dark">(
    () =>
      (typeof document !== "undefined"
        ? (document.documentElement.getAttribute("data-mode") as
            "light" | "dark")
        : null) || "dark",
  );

  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      const next = el.getAttribute("data-mode") as "light" | "dark" | null;
      if (next) setMode(next);
    });
    observer.observe(el, { attributes: true, attributeFilter: ["data-mode"] });
    return () => observer.disconnect();
  }, []);

  return (
    <Toaster
      theme={mode}
      position="bottom-right"
      style={{ zIndex: 9999 }}
      toastOptions={{
        className: "toast font-sans !text-[var(--text-1)]",
      }}
      icons={{
        success: (
          <UiIcon
            size={16}
            strokeWidth={1.5}
            className="shrink-0 text-[var(--status-done)]"
            icon={CheckCircle2}
          />
        ),
        error: (
          <UiIcon
            size={16}
            strokeWidth={1.5}
            className="shrink-0 text-[var(--status-danger)]"
            icon={AlertCircle}
          />
        ),
        info: (
          <UiIcon
            size={16}
            strokeWidth={1.5}
            className="shrink-0 text-[var(--accent)]"
            icon={Info}
          />
        ),
      }}
    />
  );
}
