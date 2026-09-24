import { cva } from "class-variance-authority";

// Kept apart from button.tsx, which merges classes through cn() and so
// pulls in tailwind-merge (~8 KiB gz). /login styles its buttons from this
// module directly and ships without it.
/**
 * Flat variants only — no gradients, no glow shadows (design overhaul
 * spec §4). `icon` and `preset` variants from the old glass-era button
 * are retired; call sites needing an icon-only button use `size="icon"`
 * with `variant="ghost"` or `variant="secondary"` instead.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-[color,background-color,border-color,transform] duration-[var(--dur-fast)] ease-[var(--ease-out)] active:scale-[0.98] outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)] touch-manipulation select-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          // Disabled primary goes neutral instead of a 50%-faded accent,
          // which on cream left a pale pink pill with an unreadable label.
          "bg-[var(--accent)] text-[var(--text-on-accent)] hover:bg-[var(--accent-hot)] active:bg-[var(--accent-deep)] disabled:bg-[var(--surface-active)] disabled:text-[var(--text-3)] disabled:opacity-100",
        secondary:
          "bg-transparent border border-[var(--border-default)] text-[var(--text-2)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] hover:text-[var(--text-1)]",
        ghost:
          "bg-transparent text-[var(--text-2)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]",
        danger:
          "bg-transparent border border-[var(--status-danger-border)] text-[var(--status-danger)] hover:bg-[var(--status-danger-dim)]",
      },
      size: {
        default:
          // 44px on touch screens, 40px where a fine pointer is the norm.
          "h-11 md:h-10 px-5 rounded-[var(--radius-md)] text-[length:var(--text-md)] font-medium gap-2",
        sm: "h-9 px-4 rounded-[var(--radius-md)] text-[length:var(--text-body)] font-medium gap-1.5",
        icon: "size-10 md:size-9 rounded-[var(--radius-md)]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export { buttonVariants };
