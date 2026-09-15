"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Icon as UiIcon } from "@/components/ui/Icon";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

function DialogOverlay({
  className,
  zIndexClassName = "z-50",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay> & {
  /**
   * Stacking-context override. Defaults to the shared dialog layer (z-50).
   * Pass a higher value when this dialog must render above another fixed
   * full-screen overlay (e.g. the Pomodoro timer at z-[200]) — see
   * PomodoroTimer.tsx for the motivating case.
   */
  zIndexClassName?: string;
}) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 bg-[var(--bg-overlay)]",
        zIndexClassName,
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showClose = true,
  zIndexClassName = "z-50",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showClose?: boolean;
  /** See {@link DialogOverlay}'s `zIndexClassName` — applied to both the overlay and the content. */
  zIndexClassName?: string;
}) {
  return (
    <DialogPortal>
      <DialogOverlay zIndexClassName={zIndexClassName} />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "modal fixed top-1/2 left-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-6",
          zIndexClassName,
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className,
        )}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close
            className="absolute top-4 right-4 rounded-[var(--radius-sm)] p-1.5 text-[var(--text-3)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-1)]"
            aria-label="Close"
          >
            <UiIcon size={16} icon={X} />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("mb-4 flex flex-col gap-1.5", className)}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "text-[length:var(--text-title-lg)] font-medium text-[var(--text-1)]",
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-[length:var(--text-body)] text-[var(--text-2)]",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
};
