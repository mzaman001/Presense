"use client";

import dynamic from "next/dynamic";
import { useState, type ComponentProps } from "react";
import { withPreload } from "@/lib/preloadable";

/**
 * The task panel starts closed but carries zod, react-hook-form, the date
 * parser and the form itself, so pages load it as its own chunk (same
 * pattern as DynamicModals) and call `.preload()` on hover/focus of their
 * Add buttons. Shared by Do and Home; Home used to import the panel directly.
 */
const LazyPanel = dynamic(
  () =>
    import("./TaskAddPanel").then((m) => ({
      default: m.TaskAddPanel,
    })),
  { ssr: false, loading: () => null },
);

type TaskAddPanelProps = ComponentProps<typeof LazyPanel>;

/**
 * Do and Home render the panel all the time with `isOpen`, and a mounted
 * `next/dynamic` fetches and runs its chunk straight away: ~73 KiB gz on
 * every visit, for a panel that's usually never opened (measured on /do).
 * Mount it the first time it opens, then keep it mounted so closing still
 * animates.
 */
function TaskAddPanelWhenOpened(props: TaskAddPanelProps) {
  const [opened, setOpened] = useState(props.isOpen);
  if (props.isOpen && !opened) setOpened(true);
  return opened ? <LazyPanel {...props} /> : null;
}

export const TaskAddPanel = withPreload(
  TaskAddPanelWhenOpened,
  () => import("./TaskAddPanel"),
);
