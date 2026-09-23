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

  // Short, soft pulses. Presense is meant to feel calm; the previous
  // five-pulse "heavy" buzz on every swipe read as an alarm, not a tap.
  // Only `error` keeps a repeated pattern, because it should interrupt.
  return {
    trigger,
    selection: () => trigger(8),
    light: () => trigger(12),
    medium: () => trigger(18),
    heavy: () => trigger(26),
    success: () => trigger([10, 40, 16]),
    error: () => trigger([24, 60, 24]),
  };
}
