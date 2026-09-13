export const RELATIONSHIP_COLORS: Record<string, string> = {
  friend: "#F59E0B",
  family: "#3B82F6",
  professor: "#8B5CF6",
  colleague: "#6B7280",
  teammate: "#10B981",
  other: "#9CA3AF",
};

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
