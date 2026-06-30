export function useHaptics() {
  const trigger = (pattern: number | number[] = 50) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // ignore
      }
    }
  };
  
  return { 
    trigger,
    selection: () => trigger(10),
    light: () => trigger(15),
    medium: () => trigger([20, 10, 20]),
    heavy: () => trigger([30, 20, 30, 20, 30]),
    success: () => trigger([10, 30, 20]),
    error: () => trigger([30, 50, 30, 50, 30])
  };
}
