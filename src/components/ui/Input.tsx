import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  hint?: string;
  label?: React.ReactNode;
  variant?: "default" | "title" | "search";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, hint, label, variant = "default", id: propsId, ...props }, ref) => {
    const generatedId = React.useId();
    const id = propsId || generatedId;
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;

    const variantClass = 
      variant === "title" ? "input-title" : 
      variant === "search" ? "input-search" : "input";

    return (
      <div className={cn("w-full", props.hidden && "hidden")}>
        {label && (
          <label htmlFor={id} className="text-label text-[var(--text-3)] block mb-2">
            {label}
          </label>
        )}
        <input
          type={type}
          id={id}
          className={cn(variantClass, error && "!border-red-500 focus:!border-red-500", className)}
          ref={ref}
          aria-invalid={!!error}
          aria-describedby={
            [error && errorId, hint && !error && hintId].filter(Boolean).join(" ") || undefined
          }
          {...props}
        />
        {error && (
          <p id={errorId} className="text-caption text-red-500 mt-1">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="text-caption text-[var(--text-3)] mt-1">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
