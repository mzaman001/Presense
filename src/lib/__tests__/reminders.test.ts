import { describe, it, expect, vi, afterEach } from "vitest";
import {
  getReminderAvailability,
  requestReminderPermission,
} from "@/lib/reminders";
import { playChime } from "@/lib/chime";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";

describe("getReminderAvailability", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reports the browser's permission when notifications exist", () => {
    vi.stubGlobal("Notification", { permission: "denied" });
    expect(getReminderAvailability()).toBe("denied");
  });

  it("asks iPhone Safari users to add Presense to the Home Screen first", () => {
    vi.stubGlobal("Notification", undefined);
    // jsdom has the property; iOS Safari tabs don't.
    delete (window as { Notification?: unknown }).Notification;
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE_UA);
    expect(getReminderAvailability()).toBe("needs-home-screen");
  });

  it("says unsupported for other browsers without notifications", () => {
    delete (window as { Notification?: unknown }).Notification;
    expect(getReminderAvailability()).toBe("unsupported");
  });
});

describe("requestReminderPermission", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks the browser and returns its answer", async () => {
    const requestPermission = vi.fn(
      async () => "granted" as NotificationPermission,
    );
    vi.stubGlobal("Notification", { permission: "default", requestPermission });
    await expect(requestReminderPermission()).resolves.toBe("granted");
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it("answers denied where notifications don't exist", async () => {
    delete (window as { Notification?: unknown }).Notification;
    await expect(requestReminderPermission()).resolves.toBe("denied");
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
