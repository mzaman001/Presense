/**
 * Minutes as "45m", "2h" or "1h 20m"; null for none.
 *
 * Its own module, not lib/utils: /login imports `cn` from utils and would
 * ship this too (it pushed /login over its bundle budget).
 */
export function formatMinutes(minutes: number | undefined | null) {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
