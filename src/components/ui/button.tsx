import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-all outline-none select-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-deep)_100%)] text-[var(--text-on-accent)] shadow-[var(--shadow-button-primary)] hover:shadow-[var(--shadow-button-primary-hover)] hover:-translate-y-[1px] active:translate-y-0 active:shadow-[var(--shadow-button-primary)] relative overflow-hidden before:absolute before:inset-0 before:h-1/2 before:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.18)_0%,transparent_100%)] before:pointer-events-none",
        secondary:
          "bg-transparent border-[0.5px] border-[var(--border-default)] text-[var(--text-2)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] hover:text-[var(--text-1)]",
        danger:
          "bg-transparent border-[0.5px] border-[var(--status-danger-border)] text-[var(--status-danger)] hover:bg-[var(--status-danger-dim)]",
        icon:
          "bg-[var(--surface-1)] border-[0.5px] border-[var(--border-default)] text-[var(--text-3)] hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)] hover:text-[var(--text-1)]",
        preset:
          "bg-[var(--surface-1)] border-[0.5px] border-[var(--border-default)] text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)] hover:text-[var(--text-1)] active:bg-[var(--accent-dim)] active:border-[var(--accent-border)] active:text-[var(--accent-text)] aria-expanded:bg-[var(--accent-dim)] aria-expanded:border-[var(--accent-border)] aria-expanded:text-[var(--accent-text)] data-[state=active]:bg-[var(--accent-dim)] data-[state=active]:border-[var(--accent-border)] data-[state=active]:text-[var(--accent-text)]",
        capture:
          "bg-[linear-gradient(135deg,var(--accent)_0%,var(--accent-deep)_100%)] text-[var(--text-on-accent)] shadow-[var(--shadow-button-primary)] hover:shadow-[var(--shadow-button-primary-hover)] hover:-translate-y-[1px] active:translate-y-0 active:shadow-[var(--shadow-button-primary)] relative overflow-hidden before:absolute before:inset-0 before:h-1/2 before:bg-[linear-gradient(to_bottom,rgba(255,255,255,0.15)_0%,transparent_100%)] before:pointer-events-none w-full",
      },
      size: {
        default: "h-10 px-[20px] rounded-[var(--radius-full)] text-[var(--text-md)] font-semibold gap-[var(--space-2)]",
        sm: "h-[38px] px-[18px] rounded-[var(--radius-full)] text-[var(--text-md)] font-medium gap-[var(--space-2)]",
        icon: "w-[34px] h-[34px] rounded-[var(--radius-sm)]",
        preset: "px-[16px] py-[7px] rounded-[var(--radius-full)] text-[var(--text-sm)] font-medium",
        capture: "px-[16px] py-[11px] rounded-[var(--radius-lg)] text-[var(--text-md)] font-semibold gap-[var(--space-2)]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ButtonPrimitive> & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
