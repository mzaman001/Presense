import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getReminderAvailability,
  notifyRitual,
  requestReminderPermission,
} from "@/lib/reminders";
import { playChime } from "@/lib/chime";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";

function setServiceWorker(value: unknown) {
  Object.defineProperty(navigator, "serviceWorker", {
    value,
    configurable: true,
  });
}

describe("notifyRitual", () => {
  const constructed: string[] = [];
  const shown: { title: string; options?: NotificationOptions }[] = [];
  const requestPermission = vi.fn(
    async () => "granted" as NotificationPermission,
  );
  let permission: NotificationPermission = "granted";
  let hidden = true;
  let constructorThrows = false;

  beforeEach(() => {
    constructed.length = 0;
    shown.length = 0;
    requestPermission.mockClear();
    permission = "granted";
    hidden = true;
    constructorThrows = false;
    class FakeNotification {
      static get permission() {
        return permission;
      }
      static requestPermission = requestPermission;
      constructor(message: string) {
        // Android Chrome: "Illegal constructor. Use showNotification()".
        if (constructorThrows) throw new TypeError("Illegal constructor");
        constructed.push(message);
      }
    }
    vi.stubGlobal("Notification", FakeNotification);
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
    setServiceWorker(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    setServiceWorker(undefined);
  });

  it("shows the reminder through the service worker when one is registered", async () => {
    setServiceWorker({
      getRegistration: async () => ({
        showNotification: async (
          title: string,
          options?: NotificationOptions,
        ) => {
          shown.push({ title, options });
        },
      }),
    });
    constructorThrows = true;
    await notifyRitual("Time to plan", { notifications_enabled: true });
    expect(shown).toHaveLength(1);
    expect(shown[0].title).toBe("Time to plan");
    // One ritual notification at a time, replacing rather than stacking.
    expect(shown[0].options?.tag).toBe("presense-ritual");
    expect(constructed).toEqual([]);
  });

  it("falls back to the page notification when no worker is registered", async () => {
    await notifyRitual("Time to plan", {});
    expect(constructed).toEqual(["Time to plan"]);
  });

  it("never throws where the page constructor is illegal (Android Chrome)", async () => {
    setServiceWorker({ getRegistration: async () => undefined });
    constructorThrows = true;
    await expect(notifyRitual("Time to plan", {})).resolves.toBeUndefined();
  });

  it("does nothing at all when the user turned reminders off", async () => {
    await notifyRitual("Time to plan", { notifications_enabled: false });
    expect(constructed).toEqual([]);
  });

  it("never asks for permission by itself; that needs a tap in Settings", async () => {
    permission = "default";
    await notifyRitual("Time to plan", {});
    expect(requestPermission).not.toHaveBeenCalled();
    expect(constructed).toEqual([]);
  });

  it("stays quiet while the tab is visible (the ritual opens in-app)", async () => {
    hidden = false;
    await notifyRitual("Time to plan", {});
    expect(constructed).toEqual([]);
  });
});

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
