import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  hint?: string;
  label?: React.ReactNode;
  variant?: "default" | "title" | "search";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      error,
      hint,
      label,
      variant = "default",
      id: propsId,
      "aria-describedby": describedBy,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const id = propsId || generatedId;
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;

    const variantClass =
      variant === "title"
        ? "input-title"
        : variant === "search"
          ? "input-search"
          : "input";

    return (
      <div className={cn("w-full", props.hidden && "hidden")}>
        {label && (
          <label
            htmlFor={id}
            className="text-label mb-2 block text-[var(--text-3)]"
          >
            {label}
          </label>
        )}
        <input
          type={type}
          id={id}
          className={cn(
            variantClass,
            error &&
              "!border-[var(--status-danger)] focus:!border-[var(--status-danger)]",
            className,
          )}
          ref={ref}
          aria-invalid={!!error}
          aria-describedby={
            [describedBy, error && errorId, hint && !error && hintId]
              .filter(Boolean)
              .join(" ") || undefined
          }
          {...props}
        />
        {error && (
          <p
            id={errorId}
            role="alert"
            className="text-meta mt-1.5 text-[var(--status-danger)]"
          >
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="text-meta mt-1.5 text-[var(--text-3)]">
            {hint}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
