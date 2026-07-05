import React from "react";
import { LucideIcon, LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

export interface IconProps extends LucideProps {
  icon: LucideIcon;
  variant?: "default" | "solid";
}

export const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ icon: IconComp, variant = "default", strokeWidth, className, ...props }, ref) => {
    // Standardize: 1.5 default, 2.0 for solid/filled button contexts
    const resolvedStrokeWidth = strokeWidth ?? (variant === "solid" ? 2 : 1.5);
    
    return (
      <IconComp
        ref={ref}
        strokeWidth={resolvedStrokeWidth}
        className={className}
        {...props}
      />
    );
  }
);
Icon.displayName = "Icon";
