/**
 * Wraps the Web Vibration API (`navigator.vibrate`).
 *
 * Honest limitation: iOS Safari does not implement the Vibration API at
 * all, in any version — there is no cross-browser way to trigger real
 * haptic feedback from a web page on iOS. `"vibrate" in navigator` is
 * `false` there, so every call below is a clean, silent no-op on iPhone
 * rather than a failure. This hook does not attempt a vibration
 * substitute; callers that want tactile-adjacent feedback on iOS should
 * pair a haptics call with a visual/motion cue (e.g. a Framer Motion
 * scale-bounce) rather than relying on this hook alone.
 */
export function useHaptics() {
  const trigger = (pattern: number | number[] = 50) => {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) {
      return;
    }
    try {
      navigator.vibrate(pattern);
    } catch {
      // Some browsers advertise `vibrate` but throw (e.g. permission
      // policy, iframe restrictions) — treat as a no-op, not an error.
    }
  };

  return {
    trigger,
    selection: () => trigger(10),
    light: () => trigger(15),
    medium: () => trigger([20, 10, 20]),
    heavy: () => trigger([30, 20, 30, 20, 30]),
    success: () => trigger([10, 30, 20]),
    error: () => trigger([30, 50, 30, 50, 30]),
  };
}
