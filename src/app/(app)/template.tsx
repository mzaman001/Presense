/**
 * Page entrance: a short rise, re-run on every navigation (a template
 * remounts per route). Enter-only on purpose: the previous `AnimatePresence
 * mode="wait"` held every navigation for a 200ms fade-out first.
 *
 * CSS, not framer-motion. The framer version server-rendered each page at
 * `opacity: 0` and only revealed it once React hydrated and the motion
 * features loaded, so every signed-in page painted blank until its
 * JavaScript had run: 6.3 s of /do's 7.3 s LCP was that render delay. A CSS
 * animation starts on first paint.
 */
export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="page-enter">{children}</div>;
}
