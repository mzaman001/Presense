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
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * The avatar background is one fixed color (a per-person/relationship
 * default, or a user's own pick from Settings > Avatar Color) that does
 * NOT change with light/dark mode. Following `--text-1` (which does
 * change with mode) for the initials text meant contrast depended on
 * mode, not on the actual background — e.g. the default `#E5B41E` gives
 * only 1.64:1 against dark-mode `--text-1`, far under the 4.5:1 AA
 * minimum.
 *
 * Picking whichever of pure black/white wins the higher contrast against
 * *this specific* background is mode-independent and provably sufficient:
 * for any background luminance, max(contrastWithWhite, contrastWithBlack)
 * has a global minimum of ~4.58:1 at the luminance where the two are
 * equal — always above the 4.5:1 AA text minimum.
 */
function getAccessibleTextColor(backgroundColor: string): string {
  const hex = backgroundColor.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "#000000"; // defensive: non-hex color input
  const channel = (start: number) =>
    parseInt(hex.slice(start, start + 2), 16) / 255;
  const linear = (v: number) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  const luminance =
    0.2126 * linear(channel(0)) +
    0.7152 * linear(channel(2)) +
    0.0722 * linear(channel(4));
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  return contrastWithWhite >= contrastWithBlack ? "#FFFFFF" : "#000000";
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      className,
      src,
      name,
      initials,
      color = "#E5B41E",
      size = "md",
      style,
      ...props
    },
    ref,
  ) => {
    const [imgError, setImgError] = React.useState(false);
    const sizeClasses = {
      sm: "w-8 h-8 text-xs",
      md: "w-10 h-10 text-sm",
      lg: "w-14 h-14 text-base",
    };
    const displayInitials = initials ?? getInitials(name);
    const label = name ? `${name}'s avatar` : "User avatar";
    const textColor = getAccessibleTextColor(color);

    return (
      <div
        ref={ref}
        role="img"
        aria-label={label}
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold",
          sizeClasses[size],
          className,
        )}
        style={{ backgroundColor: color, color: textColor, ...style }}
        {...props}
      >
        {src && !imgError ? (
          <Image
            className="aspect-square h-full w-full object-cover"
            src={src}
            alt={label}
            width={size === "sm" ? 32 : size === "md" ? 40 : 56}
            height={size === "sm" ? 32 : size === "md" ? 40 : 56}
            onError={() => setImgError(true)}
            unoptimized
          />
        ) : (
          <span aria-hidden="true">{displayInitials}</span>
        )}
      </div>
    );
  },
);
Avatar.displayName = "Avatar";
