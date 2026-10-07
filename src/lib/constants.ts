/** Task categories for someone who hasn't saved their own list. */
export const DEFAULT_DO_CATEGORIES = [
  "work",
  "study",
  "personal",
  "errand",
  "health",
];

export const DEFAULT_DO_COLORS: Record<string, string> = {
  work: "#3B82F6",
  study: "#8B5CF6",
  personal: "#10B981",
  errand: "#F59E0B",
  health: "#EF4444",
  other: "#9CA3AF",
};

/**
 * Resolves the colour for a task category: the user's own override first,
 * then the built-in default, then a neutral fallback.
 *
 * The same three-way expression was inlined at four call sites, each of
 * which indexed the colour maps with a possibly-null `category` column.
 */
export function resolveCategoryColor(
  category: string | null | undefined,
  overrides: Record<string, string> | undefined,
  fallback: string,
): string {
  if (!category) return fallback;
  return overrides?.[category] || DEFAULT_DO_COLORS[category] || fallback;
}

/**
 * How long a completed task stays on screen so its completion moment (the
 * brush ensō closing, its dot landing, the brush strike-through; see
 * globals.css) can play, and the finished mark rest for a beat, before the
 * row is removed.
 */
export const COMPLETE_HOLD_MS = 560;

/**
 * Ritual times for a user who hasn't set them: the same as user_settings'
 * column defaults and the server's reminder job, so the app and the
 * notifications agree.
 */
export const DEFAULT_NUDGE_TIME = "10:00";
export const DEFAULT_SHUTDOWN_TIME = "18:00";
