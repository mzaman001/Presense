import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastMock = vi.hoisted(() =>
  Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
);
vi.mock("sonner", () => ({ toast: toastMock }));

const enablePush = vi.hoisted(() => vi.fn());
vi.mock("@/lib/push", () => ({ enablePush }));

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/track", () => ({ track }));

const update = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "user-1" } } },
      }),
    },
    from: () => ({
      update: (patch: unknown) => {
        update(patch);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));

import { useAppStore } from "@/store/useAppStore";
import {
  formatPlanningTime,
  offerReminders,
  turnOnReminders,
} from "@/lib/reminder-optin";

function stubPermission(
  permission: NotificationPermission,
  answer: NotificationPermission = permission,
) {
  const requestPermission = vi.fn(async () => answer);
  vi.stubGlobal("Notification", { permission, requestPermission });
  return requestPermission;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  enablePush.mockResolvedValue("subscribed");
  useAppStore.setState({ userSettings: {} });
});
afterEach(() => vi.unstubAllGlobals());

describe("turnOnReminders", () => {
  it("asks inside the tap, registers the device and records it", async () => {
    const ask = stubPermission("default", "granted");
    const pending = turnOnReminders("task");
    // Requested synchronously, before any await.
    expect(ask).toHaveBeenCalledTimes(1);
    await expect(pending).resolves.toBe("on");
    expect(enablePush).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("reminders_turned_on", {
      source: "task",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("switches the account setting back on if it was off", async () => {
    stubPermission("granted");
    useAppStore.setState({ userSettings: { notifications_enabled: false } });
    await expect(turnOnReminders("task")).resolves.toBe("on");
    expect(update).toHaveBeenCalledWith({ notifications_enabled: true });
    expect(useAppStore.getState().userSettings.notifications_enabled).toBe(
      true,
    );
  });

  it("stops when the person says no", async () => {
    stubPermission("default", "denied");
    await expect(turnOnReminders("morning_plan")).resolves.toBe("denied");
    expect(enablePush).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it("never asks again once blocked", async () => {
    const ask = stubPermission("denied");
    await expect(turnOnReminders("task")).resolves.toBe("denied");
    expect(ask).not.toHaveBeenCalled();
  });

  it("reports a failed registration", async () => {
    stubPermission("granted");
    enablePush.mockResolvedValue("failed");
    await expect(turnOnReminders("task")).resolves.toBe("failed");
  });
});

describe("offerReminders", () => {
  it("offers once per device, with the planning time", () => {
    stubPermission("default");
    offerReminders("08:00:00");
    offerReminders("08:00:00");
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock.mock.calls[0][1].description).toContain("8:00 AM");
    expect(track).toHaveBeenCalledWith("reminders_offered", {
      source: "morning_plan",
    });
  });

  it("stays quiet when permission is already decided", () => {
    stubPermission("granted");
    offerReminders("08:00");
    stubPermission("denied");
    offerReminders("08:00");
    expect(toastMock).not.toHaveBeenCalled();
  });

  it("respects reminders switched off in Settings", () => {
    stubPermission("default");
    useAppStore.setState({ userSettings: { notifications_enabled: false } });
    offerReminders("08:00");
    expect(toastMock).not.toHaveBeenCalled();
  });
});

describe("formatPlanningTime", () => {
  it.each([
    ["08:00", "8:00 AM"],
    ["08:30:00", "8:30 AM"],
    ["00:05", "12:05 AM"],
    ["12:00", "12:00 PM"],
    ["18:45", "6:45 PM"],
  ])("%s → %s", (input, out) => {
    expect(formatPlanningTime(input)).toBe(out);
  });
});
