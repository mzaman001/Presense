"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export function FAB() {
  const setCaptureModalOpen = useAppStore((state) => state.setCaptureModalOpen);

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={() => {
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([15]);
        }
        setCaptureModalOpen(true);
      }}
      className="md:hidden fixed z-50 bottom-24 left-1/2 -translate-x-1/2 flex items-center justify-center w-14 h-14 rounded-full bg-[var(--color-text-1)] text-[var(--color-background)] shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_50px_rgba(255,255,255,0.4)] transition-shadow"
      aria-label="New Task"
    >
      <Plus className="w-8 h-8" />
    </motion.button>
  );
}

