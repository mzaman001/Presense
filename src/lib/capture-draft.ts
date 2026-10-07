/**
 * What's typed (or spoken) into capture but not saved yet. Closing the panel
 * with Escape, a tap outside or a swipe used to throw it away: the text lived
 * only in the panel, which unmounts on close. Kept on this device, per
 * account, until it's saved.
 */
const key = (userId: string) => `presense_capture_draft_v1:${userId}`;

export function loadCaptureDraft(userId: string): string {
  try {
    return localStorage.getItem(key(userId)) ?? "";
  } catch {
    return "";
  }
}

export function saveCaptureDraft(userId: string, text: string) {
  try {
    if (text.trim()) localStorage.setItem(key(userId), text);
    else localStorage.removeItem(key(userId));
  } catch {
    // Storage unavailable: the draft just won't outlive the panel.
  }
}

export function clearCaptureDraft(userId: string) {
  saveCaptureDraft(userId, "");
}
