import type { ComponentType } from "react";

/**
 * `next/dynamic` returns a plain component; it has no `.preload()`. Call
 * sites that want to warm a chunk before it mounts (hover/focus on the
 * button that opens it, a keyboard shortcut) used to call `.preload()`
 * anyway and threw a TypeError on every hover.
 *
 * Attach a real `preload` that runs the same `import()` the dynamic loader
 * uses. The bundler caches the module, so when the component mounts its
 * chunk is already there. Keep the `dynamic(() => import(...))` call
 * inline at the definition site so Next's compiler still recognises it.
 */
export type Preloadable<C> = C & { preload: () => void };

export function withPreload<P>(
  component: ComponentType<P>,
  load: () => Promise<unknown>,
): Preloadable<ComponentType<P>> {
  return Object.assign(component, {
    preload: () => {
      // Warming is best-effort: a failed prefetch surfaces again (and is
      // handled) when the component actually mounts.
      load().catch(() => {});
    },
  });
}
