import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string;
  initials?: string;
  src?: string;
  color?: string;
  size?: "sm" | "md" | "lg";
}

function getInitials(name?: string): string {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, name, initials, color = "#E5B41E", size = "md", style, ...props }, ref) => {
    const sizeClasses = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-base" };
    const displayInitials = initials ?? getInitials(name);

    return (
      <div
        ref={ref}
        className={cn(
          "relative flex shrink-0 overflow-hidden rounded-full items-center justify-center font-semibold text-[var(--color-text-1)]",
          sizeClasses[size],
          className
        )}
        style={{ backgroundColor: color, ...style }}
        {...props}
      >
        {src ? (
          <Image 
            className="aspect-square h-full w-full object-cover" 
            src={src} 
            alt={name ? `${name}'s avatar` : "User avatar"} 
            width={size === "sm" ? 32 : size === "md" ? 40 : 56} 
            height={size === "sm" ? 32 : size === "md" ? 40 : 56} 
            unoptimized 
          />
        ) : (
          <span>{displayInitials}</span>
        )}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";
