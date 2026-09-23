import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { notifyRitual } from "@/lib/reminders";
import { playChime } from "@/lib/chime";

describe("notifyRitual", () => {
  const constructed: string[] = [];
  const requestPermission = vi.fn(
    async () => "granted" as NotificationPermission,
  );
  let permission: NotificationPermission = "granted";
  let hidden = true;

  beforeEach(() => {
    constructed.length = 0;
    requestPermission.mockClear();
    class FakeNotification {
      static get permission() {
        return permission;
      }
      static requestPermission = requestPermission;
      constructor(message: string) {
        constructed.push(message);
      }
    }
    vi.stubGlobal("Notification", FakeNotification);
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows a notification when enabled, granted and the tab is hidden", () => {
    permission = "granted";
    hidden = true;
    notifyRitual("Time to plan", { notifications_enabled: true });
    expect(constructed).toEqual(["Time to plan"]);
  });

  it("does nothing at all when the user turned notifications off", () => {
    permission = "default";
    notifyRitual("Time to plan", { notifications_enabled: false });
    expect(constructed).toEqual([]);
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("treats an unset preference as on, and asks for permission once needed", () => {
    permission = "default";
    notifyRitual("Time to plan", {});
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(constructed).toEqual([]);
  });

  it("stays quiet while the tab is visible (the ritual opens in-app)", () => {
    permission = "granted";
    hidden = false;
    notifyRitual("Time to plan", {});
    expect(constructed).toEqual([]);
  });
});

describe("playChime", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("synthesises the chime with Web Audio instead of loading a file", () => {
    const started: number[] = [];
    const osc = () => ({
      type: "",
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn((t: number) => started.push(t)),
      stop: vi.fn(),
    });
    const gain = () => ({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    });
    class FakeAudioContext {
      currentTime = 0;
      destination = {};
      state = "running";
      createOscillator = osc;
      createGain = gain;
      resume = vi.fn();
      close = vi.fn();
    }
    vi.stubGlobal("AudioContext", FakeAudioContext);

    playChime();
    // Two notes, the second after the first.
    expect(started).toHaveLength(2);
    expect(started[1]).toBeGreaterThan(started[0]);
  });

  it("is a silent no-op where Web Audio is unavailable", () => {
    vi.stubGlobal("AudioContext", undefined);
    expect(() => playChime()).not.toThrow();
  });
});
