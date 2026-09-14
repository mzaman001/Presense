/**
 * Computes the length of the current consecutive-day streak of morning
 * ritual completions, counting backward from `today`. If today's ritual
 * isn't done yet, the streak still counts through yesterday (a user
 * shouldn't see their streak drop to 0 before their morning window has
 * even passed) — but a gap of two or more days breaks it.
 */
export function computeRitualStreak(dates: string[], today: Date): number {
  const uniqueDates = new Set(dates);
  if (uniqueDates.size === 0) return 0;

  const cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);

  const toDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // If today isn't in the set, start counting from yesterday instead —
  // a missed-so-far-today morning shouldn't zero out an existing streak.
  if (!uniqueDates.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!uniqueDates.has(toDateKey(cursor))) return 0;
  }

  let streak = 0;
  while (uniqueDates.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
