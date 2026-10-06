import { describe, it, expect } from "vitest";
import {
  planRenewals,
  type DoneRecurringTask,
} from "../../../supabase/functions/cron_recurrence/renewals";

// cron_recurrence used to seed a new copy from every completed instance it
// could see (90 days back), every hour. Nothing recorded that an instance
// had been renewed, so deleting the upcoming copy brought it back within the
// hour, and whichever old completion came first decided the next deadline.
// planRenewals picks one seed per series (the latest completion) and lists
// every instance the run should mark as renewed.

function task(
  id: string,
  completedAt: string,
  over: Partial<DoneRecurringTask> = {},
): DoneRecurringTask {
  return {
    id,
    user_id: "u1",
    title: "Meditate",
    recurrence: "FREQ=DAILY",
    completed_at: completedAt,
    ...over,
  };
}

describe("planRenewals", () => {
  it("seeds a series from its latest completion, whatever the row order", () => {
    const plans = planRenewals([
      task("mon", "2026-10-05T07:00:00Z"),
      task("wed", "2026-10-07T07:00:00Z"),
      task("tue", "2026-10-06T07:00:00Z"),
    ]);
    expect(plans).toHaveLength(1);
    expect(plans[0].seed.id).toBe("wed");
    expect(plans[0].instanceIds.sort()).toEqual(["mon", "tue", "wed"]);
  });

  it("keeps series apart by user, title and rule", () => {
    const plans = planRenewals([
      task("a", "2026-10-05T07:00:00Z"),
      task("b", "2026-10-05T07:00:00Z", { user_id: "u2" }),
      task("c", "2026-10-05T07:00:00Z", { title: "Stretch" }),
      task("d", "2026-10-05T07:00:00Z", { recurrence: "FREQ=WEEKLY" }),
    ]);
    expect(plans.map((p) => p.seed.id).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("returns nothing when there is nothing to renew", () => {
    expect(planRenewals([])).toEqual([]);
  });
});
