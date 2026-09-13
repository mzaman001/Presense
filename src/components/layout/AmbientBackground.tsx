/**
 * The ambient orb/glass background system is retired (design overhaul
 * spec §4 — flat surfaces, no gradients/glow). Kept as a no-op rather
 * than deleted so `(app)/layout.tsx` and `onboarding/layout.tsx` don't
 * need an import removed in this pass — see AGENTS.md §2.5 ("prove
 * unreferenced first" applies to deleting the component itself, not to
 * emptying its body).
 */
export function AmbientBackground() {
  return null;
}
