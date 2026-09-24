/**
 * Wraps the Web Vibration API (`navigator.vibrate`).
 *
 * iOS Safari does not implement the Vibration API, so on iPhone/iPad this
 * falls back to the native-switch tick (see iosTick), which works on iOS 18+
 * and is silent before that. Desktop browsers have no haptics at all, so
 * callers should always pair a haptic with a visual cue.
 */
function isIOS() {
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * iOS 18+ Safari plays the system haptic when a native switch
 * (`<input type="checkbox" switch>`) is toggled by a user gesture, and that
 * is the only haptic a web page can reach on iPhone. Clicking a hidden
 * switch's label from inside the tap handler triggers it; older iOS and
 * desktops ignore the attribute and nothing happens.
 */
function iosTick() {
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.style.cssText =
    "position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  label.click();
  label.remove();
}

export function useHaptics() {
  const trigger = (pattern: number | number[] = 50) => {
    if (typeof navigator === "undefined") return;
    if (!("vibrate" in navigator)) {
      if (!isIOS()) return;
      // One tick per pulse of the pattern (every other entry is a pause).
      const pulses = Array.isArray(pattern)
        ? pattern.filter((_, i) => i % 2 === 0).length
        : 1;
      let at = 0;
      for (let i = 0; i < pulses; i++) {
        if (i === 0) iosTick();
        else setTimeout(iosTick, at);
        at += 70;
      }
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
