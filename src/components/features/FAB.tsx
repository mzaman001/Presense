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
      transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
      onClick={() => setCaptureModalOpen(true)}
      className="fixed z-50 bottom-24 md:bottom-8 right-6 flex items-center justify-center w-14 h-14 rounded-full bg-[var(--color-text-1)] text-[var(--color-background)] shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all"
    >
      <Plus className="w-8 h-8" />
    </motion.button>
  );
}
