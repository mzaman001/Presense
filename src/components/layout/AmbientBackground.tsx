/**
 * The horizon light behind the app: sunrise in light mode, sunset in dark.
 *
 * This replaces the retired orb/glass system (which animated blurred
 * blobs every frame). It is a single fixed element painted with two
 * static radial gradients from `.atmosphere` in globals.css — no filter,
 * no animation, no JS — so it is a Server Component and costs one paint.
 * Colours and positions come from the --atmos-* tokens, which flip with
 * `data-mode`.
 */
export function AmbientBackground() {
  return <div aria-hidden="true" className="atmosphere" />;
}
