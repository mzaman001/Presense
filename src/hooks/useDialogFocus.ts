"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isShown(el: HTMLElement): boolean {
  if (typeof el.checkVisibility === "function") {
    return el.checkVisibility({ visibilityProperty: true });
  }
  // No checkVisibility (older Safari, jsdom): walk up the ancestors.
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    if (node.hidden || node.inert) return false;
    const style = getComputedStyle(node);
    if (style.display === "none") return false;
    if (node === el && style.visibility === "hidden") return false;
  }
  return true;
}

/**
 * The elements Tab can reach inside `container`, in order. Rendered but
 * hidden ones (`hidden`, `display: none`, a breakpoint-only strip) are left
 * out: counting them made a hidden element the "last" stop, so Tab never
 * wrapped and walked out of the dialog.
 */
export function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    isShown,
  );
}

// Open dialogs' containers, newest last. Each keeps Tab only while focus is
// inside it; focus that has strayed outside all of them goes to the newest.
// Otherwise a confirmation opened over Settings is fought over by both.
type OpenDialog = { container: () => HTMLElement | null };
const openDialogs: OpenDialog[] = [];

function innermostDialogHolding(el: Element): OpenDialog | undefined {
  let found: OpenDialog | undefined;
  let foundEl: HTMLElement | null = null;
  for (const d of openDialogs) {
    const c = d.container();
    if (c?.contains(el) && (!foundEl || foundEl.contains(c))) {
      found = d;
      foundEl = c;
    }
  }
  return found;
}

/**
 * Traps focus within a modal/dialog for keyboard accessibility (WCAG 2.1 - 2.1.2).
 * Restores focus to the trigger element when the modal closes or unmounts.
 *
 * @param isOpen - Whether the modal is currently open
 * @returns ref to attach to the modal container
 */
export function useDialogFocus(isOpen: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previous = document.activeElement as HTMLElement | null;
    const token: OpenDialog = { container: () => containerRef.current };
    openDialogs.push(token);

    // Focus first focusable element inside the modal after animation
    const timer = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;

      // Focus already landed inside (autoFocus, or the user clicked a
      // field during the animation): moving it would blur that field.
      const active = document.activeElement;
      if (active && active !== container && container.contains(active)) {
        return;
      }

      // 1. Try to find an explicit autofocus target
      const autoFocusTarget = container.querySelector<HTMLElement>(
        "[autofocus], [data-autofocus]",
      );
      if (autoFocusTarget) {
        autoFocusTarget.focus();
        return;
      }

      // 2. Fall back to the first focusable element
      focusableWithin(container)[0]?.focus();
    }, 350);

    const handleKeyDown = (e: KeyboardEvent) => {
      const container = containerRef.current;
      if (e.key !== "Tab" || !container) return;
      const active = document.activeElement;
      const holder = active ? innermostDialogHolding(active) : undefined;
      if (holder ? holder !== token : openDialogs.at(-1) !== token) return;

      const focusable = focusableWithin(container);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!holder) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    // Runs when isOpen turns false and when the dialog unmounts. Settings and
    // the sheets close by unmounting, so restoring only on isOpen=false
    // (as this used to) never ran for them.
    const container = containerRef.current;
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      openDialogs.splice(openDialogs.indexOf(token), 1);

      if (!previous || previous === document.body || !previous.isConnected) {
        return;
      }
      // Don't take focus from somewhere the user has since moved it.
      const active = document.activeElement;
      const focusLeftWithDialog =
        !active ||
        active === document.body ||
        (container !== null && container.contains(active));
      if (focusLeftWithDialog) previous.focus();
    };
  }, [isOpen]);

  return containerRef;
}
