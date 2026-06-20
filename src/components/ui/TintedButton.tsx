import React from "react";
import { cn } from "@/lib/utils";

interface TintedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "remember" | "think" | "explore" | "do" | "success";
  icon?: React.ReactNode;
}

const variantStyles = {
  remember: "bg-[rgba(244,114,182,0.12)] border-[rgba(244,114,182,0.25)] text-[#F472B6] hover:bg-[rgba(244,114,182,0.2)]",
  think: "bg-[rgba(45,212,191,0.12)] border-[rgba(45,212,191,0.25)] text-[#2DD4BF] hover:bg-[rgba(45,212,191,0.2)]",
  do: "bg-[rgba(248,113,113,0.12)] border-[rgba(248,113,113,0.25)] text-[#F87171] hover:bg-[rgba(248,113,113,0.2)]",
  explore: "bg-[rgba(251,191,36,0.12)] border-[rgba(251,191,36,0.25)] text-[#FBBF24] hover:bg-[rgba(251,191,36,0.2)]",
  success: "bg-[rgba(74,222,128,0.12)] border-[rgba(74,222,128,0.25)] text-[#4ADE80] hover:bg-[rgba(74,222,128,0.2)]",
};

export const TintedButton = React.forwardRef<HTMLButtonElement, TintedButtonProps>(
  ({ className, variant = "remember", icon, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl text-card-title transition-colors border",
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {icon}
        {children}
      </button>
    );
  }
);

TintedButton.displayName = "TintedButton";
