/** "Good morning" / "Good afternoon" / "Good evening" for an hour (0–23). */
export function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** The current hour in a time zone (the server's own when none or invalid). */
export function hourIn(timeZone: string | null | undefined, now = new Date()) {
  try {
    const h = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: timeZone || undefined,
    }).format(now);
    return Number(h) % 24;
  } catch {
    return now.getHours();
  }
}

/**
 * "18:00:00" → "6 PM", "18:30:00" → "6:30 PM". Deterministic (no locale),
 * so the server and the browser render the same text.
 */
export function formatTimeOfDay(value: string | null | undefined): string {
  const [h, m] = (value || "18:00").split(":").map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const suffix = h < 12 ? "AM" : "PM";
  return m
    ? `${hour12}:${String(m).padStart(2, "0")} ${suffix}`
    : `${hour12} ${suffix}`;
}
