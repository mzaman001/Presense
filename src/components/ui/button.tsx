import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Flat variants only — no gradients, no glow shadows (design overhaul
 * spec §4). `icon` and `preset` variants from the old glass-era button
 * are retired; call sites needing an icon-only button use `size="icon"`
 * with `variant="ghost"` or `variant="secondary"` instead.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-colors outline-none select-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--accent)] text-[var(--text-on-accent)] hover:bg-[var(--accent-hot)] active:bg-[var(--accent-deep)]",
        secondary:
          "bg-transparent border border-[var(--border-default)] text-[var(--text-2)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] hover:text-[var(--text-1)]",
        ghost:
          "bg-transparent text-[var(--text-2)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]",
        danger:
          "bg-transparent border border-[var(--status-danger-border)] text-[var(--status-danger)] hover:bg-[var(--status-danger-dim)]",
      },
      size: {
        default:
          "h-10 px-5 rounded-[var(--radius-md)] text-[length:var(--text-md)] font-medium gap-2",
        sm: "h-9 px-4 rounded-[var(--radius-md)] text-[length:var(--text-md)] font-medium gap-2",
        icon: "w-9 h-9 rounded-[var(--radius-md)]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ButtonPrimitive> &
  VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
