"use client";

import dynamic from "next/dynamic";
import { withPreload } from "@/lib/preloadable";

/**
 * The task panel starts closed but carries zod, react-hook-form and the form
 * itself, so pages load it as its own chunk (same pattern as DynamicModals)
 * and call `.preload()` on hover/focus of their Add buttons. Shared by Do
 * and Home; Home used to import the panel directly.
 */
export const TaskAddPanel = withPreload(
  dynamic(
    () =>
      import("./TaskAddPanel").then((m) => ({
        default: m.TaskAddPanel,
      })),
    { ssr: false, loading: () => null },
  ),
  () => import("./TaskAddPanel"),
);
