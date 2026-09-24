/**
 * How many of the last 7 days (today included) had a morning plan.
 *
 * Replaces a consecutive-day streak. A broken streak lowers engagement
 * regardless of what the person actually did, worst when they blame
 * themselves (Silverman & Barasch 2023), and "I didn't plan today" is
 * exactly that kind of break. A rolling count shrugs off one missed day:
 * 6 of 7 is still a good week, where a streak would read 0.
 *
 * `dateKeys` are local calendar dates as "YYYY-MM-DD".
 */
export function daysPlannedInLastWeek(dateKeys: string[], today: Date): number {
  const planned = new Set(dateKeys);
  const cursor = new Date(today);
  cursor.setHours(12, 0, 0, 0); // midday: steps by calendar day across DST
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const key = [
      cursor.getFullYear(),
      String(cursor.getMonth() + 1).padStart(2, "0"),
      String(cursor.getDate()).padStart(2, "0"),
    ].join("-");
    if (planned.has(key)) count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}
