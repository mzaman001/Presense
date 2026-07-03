export type RitualKind = "morning" | "evening" | "none";

export interface RitualDecisionInput {
  now: Date;
  nudgeTime?: string | null;
  shutdownTime?: string | null;
  lastMorningDate?: string | null;
  lastEveningDate?: string | null;
  manual?: boolean;
}

export interface RitualDecision {
  kind: RitualKind;
  targetDate: string | null;
  reason:
    | "before_morning_window"
    | "morning_due"
    | "morning_completed"
    | "morning_window_missed"
    | "evening_due"
    | "evening_completed"
    | "before_evening_window"
    | "manual_planning"
    | "manual_evening_planning_for_tomorrow";
  nextEligibleAt: string | null;
}

const MORNING_WINDOW_HOURS = 6;
const EVENING_PLANNING_CUTOFF_HOUR = 15;

function parseTimeToMinutes(value = "09:00") {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function eligibleAt(now: Date, minutes: number) {
  const next = new Date(now);
  next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return next.toISOString();
}

export function getRitualDecision(input: RitualDecisionInput): RitualDecision {
  const now = input.now;
  const today = toDateKey(now);
  const nudgeMinutes = parseTimeToMinutes(input.nudgeTime || "09:00");
  const shutdownMinutes = parseTimeToMinutes(input.shutdownTime || "17:00");
  const currentMinutes = minutesSinceMidnight(now);
  const morningWindowEnd = nudgeMinutes + MORNING_WINDOW_HOURS * 60;
  const morningDone = input.lastMorningDate === today;
  const eveningDone = input.lastEveningDate === today;

  if (input.manual) {
    if (now.getHours() >= EVENING_PLANNING_CUTOFF_HOUR) {
      return {
        kind: "morning",
        targetDate: toDateKey(addDays(now, 1)),
        reason: "manual_evening_planning_for_tomorrow",
        nextEligibleAt: null,
      };
    }
    return { kind: "morning", targetDate: today, reason: "manual_planning", nextEligibleAt: null };
  }

  if (currentMinutes >= shutdownMinutes && !eveningDone && morningDone) {
    return { kind: "evening", targetDate: today, reason: "evening_due", nextEligibleAt: null };
  }

  if (currentMinutes < nudgeMinutes) {
    return { kind: "none", targetDate: null, reason: "before_morning_window", nextEligibleAt: eligibleAt(now, nudgeMinutes) };
  }

  if (!morningDone && currentMinutes < morningWindowEnd) {
    return { kind: "morning", targetDate: today, reason: "morning_due", nextEligibleAt: null };
  }

  if (!morningDone) {
    return { kind: "none", targetDate: null, reason: "morning_window_missed", nextEligibleAt: eligibleAt(addDays(now, 1), nudgeMinutes) };
  }

  if (eveningDone) {
    return { kind: "none", targetDate: null, reason: "evening_completed", nextEligibleAt: eligibleAt(addDays(now, 1), nudgeMinutes) };
  }

  return { kind: "none", targetDate: null, reason: "before_evening_window", nextEligibleAt: eligibleAt(now, shutdownMinutes) };
}
