/**
 * The focus timer's saved state, kept in localStorage so an open session
 * survives a reload, a closed tab or a crash.
 *
 * Previously only the countdown was saved, and not the fact that it was
 * paused: after a reload a paused timer carried on counting from its
 * original start. The open timer itself (the store's activeTimer) wasn't
 * saved at all, so it vanished on reload and this state sat unused.
 */

export type Phase = "work" | "short_break" | "long_break";

export interface FocusTimerState {
  taskId: string | null;
  taskTitle: string | null;
  firstStep?: string | null;
  phase: Phase;
  sessionCount: number;
  /** When the current phase started (ms), adjusted for any pauses. */
  startedAt: number;
  /** Length of the current phase, in seconds. */
  duration: number;
  /** Seconds left when paused; null while running. */
  pausedRemaining?: number | null;
  /** Shown as the small floating pill instead of the full-screen view. */
  minimized?: boolean;
  /**
   * A short start (shorter than the user's Pomodoro length). It ends with
   * "Keep going / Done for now" instead of rolling into a break.
   */
  shortStart?: boolean;
}

const STORAGE_KEY = "pomodoro_state";

export function saveFocusTimer(state: FocusTimerState | null) {
  try {
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: the session still runs, it just won't survive
    // a reload.
  }
}

const PHASES: readonly Phase[] = ["work", "short_break", "long_break"];

/** A saved state from an older version, or corrupted, isn't a timer. */
function isFocusTimerState(value: unknown): value is FocusTimerState {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    PHASES.includes(s.phase as Phase) &&
    Number.isFinite(s.startedAt) &&
    Number.isFinite(s.duration) &&
    (s.duration as number) > 0
  );
}

export function loadFocusTimer(): FocusTimerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state: unknown = JSON.parse(raw);
    return isFocusTimerState(state) ? state : null;
  } catch {
    return null;
  }
}

/** Seconds left in a saved phase, honouring a pause. */
export function remainingSeconds(
  state: Pick<FocusTimerState, "startedAt" | "duration" | "pausedRemaining">,
  now: number = Date.now(),
): number {
  if (state.pausedRemaining != null) return state.pausedRemaining;
  const elapsed = Math.floor((now - state.startedAt) / 1000);
  return Math.max(0, state.duration - elapsed);
}

/**
 * The lengths offered when starting on a task: short starts for getting
 * going, plus the user's own session length. The research found no reason
 * to privilege any one length, so the choice is the user's.
 */
export function startLengths(sessionMinutes: number): number[] {
  return [...new Set([2, 5, 10, sessionMinutes])]
    .filter((m) => m > 0)
    .sort((a, b) => a - b);
}

const LOGGED_KEY = "pomodoro_logged";
/** Tabs finish the same phase within moments of each other. */
const SAME_SESSION_MS = 30_000;

/**
 * Claims the right to log a finished phase. Every open tab restores the same
 * saved timer and finishes it, and each used to log it, doubling the time
 * spent. The first tab to finish records the phase and its end; a tab that
 * finds the same phase ending within moments of that skips logging.
 */
export function claimSessionLog(phase: Phase, endedAt: number): boolean {
  try {
    const raw = localStorage.getItem(LOGGED_KEY);
    const last = raw
      ? (JSON.parse(raw) as { phase?: string; endedAt?: number })
      : null;
    if (
      last?.phase === phase &&
      typeof last.endedAt === "number" &&
      Math.abs(last.endedAt - endedAt) < SAME_SESSION_MS
    ) {
      return false;
    }
    localStorage.setItem(LOGGED_KEY, JSON.stringify({ phase, endedAt }));
  } catch {
    // Storage unavailable: one tab only, so log as before.
  }
  return true;
}
