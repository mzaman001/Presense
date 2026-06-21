/**
 * Shared Framer Motion animation configs for consistent, beautiful animations.
 * Respects prefers-reduced-motion for accessibility.
 */

export function useReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Page transition variants
export const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const pageTransition = {
  duration: 0.22,
  ease: [0.25, 0.46, 0.45, 0.94] as const,
};

// Modal enter/exit
export const modalBackdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const modalVariants = {
  initial: { opacity: 0, scale: 0.97, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97, y: 8 },
};

export const modalTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 28,
};

// Slide up (for panels, sheets)
export const slideUpVariants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 16 },
};

// Fade in
export const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

// List item stagger
export const listContainerVariants = {
  animate: {
    transition: {
      staggerChildren: 0.04,
    },
  },
};

export const listItemVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97 },
};

// Task card swipe delete
export const swipeDeleteVariants = {
  exit: { x: -100, opacity: 0, transition: { duration: 0.2 } },
};

// Standard transition
export const standardTransition = {
  duration: 0.2,
  ease: [0.25, 0.46, 0.45, 0.94] as const,
};

// Hover scale (use with motion.div or motion.button)
export const hoverScaleProps = {
  whileHover: { scale: 1.03 },
  whileTap: { scale: 0.97 },
  transition: { duration: 0.15 },
};

export const hoverScaleSmallProps = {
  whileHover: { scale: 1.05 },
  whileTap: { scale: 0.95 },
  transition: { duration: 0.12 },
};
