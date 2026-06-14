import React from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hoverable = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "glass-panel p-6",
          hoverable && "cursor-pointer",
          className
        )}
        {...props}
      />
    );
  }
);
GlassCard.displayName = "GlassCard";
