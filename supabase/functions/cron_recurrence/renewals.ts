/**
 * Which completed recurring tasks to renew, and from which one.
 *
 * Every completed instance of a series (same user, title and rule) is renewed
 * once: the run seeds the next copy from the series' latest completion and
 * marks all the instances it saw as renewed (items.recurrence_renewed_at).
 * Before, nothing was marked, so every hourly run seeded from every
 * completion in the last 90 days: deleting the upcoming copy, or clearing its
 * rule, brought it back within the hour, and whichever old completion came
 * first decided the next deadline.
 */
export interface DoneRecurringTask {
  id: string;
  user_id: string;
  title: string;
  recurrence: string;
  completed_at: string;
}

export interface RenewalPlan<T extends DoneRecurringTask> {
  /** The latest completion: the next copy is built from it. */
  seed: T;
  /** Every instance of the series in this run, to mark as renewed. */
  instanceIds: string[];
}

export function planRenewals<T extends DoneRecurringTask>(
  tasks: T[],
): RenewalPlan<T>[] {
  const series = new Map<string, RenewalPlan<T>>();
  for (const task of tasks) {
    const key = JSON.stringify([task.user_id, task.title, task.recurrence]);
    const plan = series.get(key);
    if (!plan) {
      series.set(key, { seed: task, instanceIds: [task.id] });
      continue;
    }
    plan.instanceIds.push(task.id);
    if (Date.parse(task.completed_at) > Date.parse(plan.seed.completed_at))
      plan.seed = task;
  }
  return [...series.values()];
}
