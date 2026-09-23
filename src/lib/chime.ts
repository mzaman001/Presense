/**
 * The focus-finished chime: two soft sine notes, synthesised with Web Audio.
 * It used to play /notification.mp3, a file that was never shipped; the 404
 * was swallowed, so "Focus finish sound" did nothing. Synthesis needs no
 * asset and no network.
 */
export function playChime() {
  const Ctx =
    typeof window !== "undefined"
      ? (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext)
      : undefined;
  if (!Ctx) return;

  try {
    const ctx = new Ctx();
    if (ctx.state === "suspended") void ctx.resume();
    const start = ctx.currentTime;
    // A5 then E6: a rising fifth reads as "done", not as an alarm.
    [880, 1318.5].forEach((freq, i) => {
      const t = start + i * 0.16;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.95);
    });
    setTimeout(() => void ctx.close(), 1400);
  } catch {
    // Audio is a nicety; never let it break finishing a session.
  }
}
