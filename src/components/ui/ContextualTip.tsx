"use client";

import { useState, useEffect } from "react";
import { X, Lightbulb } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ContextualTipProps {
  id: string;
  title: string;
  description: string;
}

export function ContextualTip({ id, title, description }: ContextualTipProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const hidden = localStorage.getItem(`hide_tip_${id}`);
    if (!hidden) setIsVisible(true);
  }, [id]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(`hide_tip_${id}`, "true");
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.2 } }}
          className="relative mb-6 overflow-hidden rounded-xl bg-gradient-to-r from-[rgba(229,180,30,0.1)] to-[rgba(235,66,51,0.05)] border border-[rgba(229,180,30,0.2)] p-4 shadow-lg flex items-start gap-3"
        >
          <div className="mt-0.5 w-8 h-8 rounded-full bg-[rgba(229,180,30,0.2)] flex items-center justify-center flex-shrink-0 text-[#E5B41E]">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div className="flex-1 pr-6">
            <h4 className="text-sm font-semibold text-[#E5B41E] mb-1">{title}</h4>
            <p className="text-sm text-[var(--color-text-2)] leading-relaxed">{description}</p>
          </div>
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-[var(--color-surface)] transition-colors text-[var(--color-text-3)] hover:text-[var(--color-text-1)]"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
