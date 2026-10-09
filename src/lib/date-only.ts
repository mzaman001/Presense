/**
 * The deadline for a date with no time: the end of that day, 23:59, as the
 * task parser uses. Do counts a task as overdue once its deadline passes, so
 * a date-only task set to 00:00 (as calendar drops and all-day slots did)
 * was overdue from the moment its day began.
 */
export function dateOnlyDeadline(day: Date): Date {
  const deadline = new Date(day);
  deadline.setHours(23, 59, 0, 0);
  return deadline;
}

/**
 * Whether a deadline means "that day, no particular time": 23:59 (how date-
 * only tasks are saved) or 00:00 (how the calendar saved them before). The
 * calendar only recognised 00:00, so a task typed as "pay rent on Friday"
 * sat in the 11 pm slot instead of the all-day row.
 */
export function isDateOnly(deadline: Date): boolean {
  const h = deadline.getHours();
  const m = deadline.getMinutes();
  return (h === 23 && m === 59) || (h === 0 && m === 0);
}
