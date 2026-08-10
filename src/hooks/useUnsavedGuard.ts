import { useEffect } from "react";

/**
 * BUG-42: Registers a `beforeunload` listener while `isDirty` is true so the
 * browser prompts before refresh / tab-close / back-out loses unsaved form
 * data. Only attached while dirty — never fires spuriously on clean state.
 */
export function useUnsavedGuard(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy-compat: some browsers only show the prompt when returnValue is set
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);
}
