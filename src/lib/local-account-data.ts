/**
 * What this device keeps for an account in localStorage, cleared when it
 * leaves. Deleting the account used to clear only the theme keys, leaving
 * that account's unsynced captures, the capture draft and the saved focus
 * timer (with its task title) on the device.
 *
 * Signing out keeps unsynced captures (they sync on the next sign-in: the
 * zero-loss promise) but clears the draft and the focus timer. Deleting the
 * account clears everything.
 */
const SHARED_KEYS = [
  "presense_theme",
  "presense_color_mode",
  "presense_reduce_motion",
  "pomodoro_state",
  "pomodoro_logged",
];

export function clearLocalAccountData(
  userId: string,
  { keepUnsyncedCaptures }: { keepUnsyncedCaptures: boolean },
) {
  try {
    for (const key of SHARED_KEYS) localStorage.removeItem(key);
    localStorage.removeItem(`presense_capture_draft_v1:${userId}`);
    if (!keepUnsyncedCaptures) {
      localStorage.removeItem(`presense_capture_outbox_v1:${userId}`);
    }
  } catch {
    // Storage unavailable: nothing was kept there either.
  }
}
