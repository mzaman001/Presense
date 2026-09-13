import { useMediaQuery } from "@/hooks/useMediaQuery";

/** True when the primary pointer is coarse (touch). */
export function useIsTouch(): boolean {
  return useMediaQuery("(pointer: coarse)");
}
