// How panels open and close: Sheet (capture, search, task, location,
// reminder, stuck-task) and the Settings dialog. One place, so they all feel
// the same.
//
// The feel is calm: short travel, opacity leading, a long soft ease-out on
// the way in, a quicker and smaller exit, never an overshoot. Only transform
// and opacity animate, which the compositor handles without layout.
// MotionProvider applies the OS and in-app Reduce motion setting
// (reducedMotion), which drops the movement and keeps the fade.

const easeOutSoft = [0.16, 1, 0.3, 1] as const;
// A gentler start than easeOutSoft, for the longer sheet travel.
const easeSheet = [0.32, 0.72, 0, 1] as const;
const easeExit = [0.4, 0, 0.2, 1] as const;

/** Desktop dialogs and full-screen panels: fade in while rising 16 px. */
export const settleMotion = {
  initial: { opacity: 0, y: 16, scale: 0.985 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.38, ease: easeOutSoft },
  },
  exit: {
    opacity: 0,
    y: 8,
    scale: 0.99,
    transition: { duration: 0.2, ease: easeExit },
  },
};

/**
 * Phone bottom sheets: still rise from below, since they're swiped down to
 * close, but travel a third of their height and fade in on the way.
 */
export const softSheetMotion = {
  initial: { opacity: 0, y: "34%" },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      y: { duration: 0.52, ease: easeSheet },
      opacity: { duration: 0.29, ease: easeExit },
    },
  },
  exit: {
    opacity: 0,
    y: "22%",
    transition: { duration: 0.24, ease: easeExit },
  },
};

/** After a swipe down: keep going the way the finger went. */
export const swipedSheetExit = {
  opacity: 0,
  y: "100%",
  transition: { duration: 0.24, ease: easeExit },
};

/** The dim behind a panel: slower than the panel, so the page dims gently. */
export const backdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.34, ease: easeExit } },
  exit: { opacity: 0, transition: { duration: 0.22, ease: easeExit } },
};
