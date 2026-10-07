import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { render, waitFor } from "@/lib/__tests__/test-utils";
import { useAppStore } from "@/store/useAppStore";
import { TimezoneSync } from "@/components/layout/TimezoneSync";

const device = vi.hoisted(() => ({ zone: "Asia/Kolkata" }));
vi.mock("@/lib/zoned-date", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/zoned-date")>()),
  deviceTimeZone: () => device.zone,
}));

const eqMock = vi.fn(async () => ({
  error: null as null | { message: string },
}));
const updateMock = vi.fn(() => ({ eq: eqMock }));
vi.mock("@/lib/supabase", () => ({
  createClient: () => ({ from: () => ({ update: updateMock }) }),
}));

const initial = useAppStore.getState();

beforeEach(() => {
  device.zone = "Asia/Kolkata";
  updateMock.mockClear();
  eqMock.mockClear();
  // The sync waits for an idle moment; here the browser is idle at once.
  vi.stubGlobal("requestIdleCallback", (cb: () => void) => {
    cb();
    return 1;
  });
  vi.stubGlobal("cancelIdleCallback", () => {});
});
afterEach(() => {
  // Unmount first: the component's cleanup calls cancelIdleCallback, which
  // must still be stubbed then.
  cleanup();
  vi.unstubAllGlobals();
  useAppStore.setState(initial, true);
});

describe("TimezoneSync", () => {
  it("saves the device's timezone when automatic and different", async () => {
    useAppStore.setState({
      userSettings: { timezone: "UTC", timezone_auto: true },
    });
    render(<TimezoneSync />);
    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith({ timezone: "Asia/Kolkata" }),
    );
    expect(useAppStore.getState().userSettings.timezone).toBe("Asia/Kolkata");
  });

  it("never saves a zone the runtime doesn't know", async () => {
    // Chromium reports Etc/Unknown when the OS timezone is misconfigured;
    // saved, it made the server render of /do throw on every visit.
    device.zone = "Etc/Unknown";
    useAppStore.setState({
      userSettings: { timezone: "UTC", timezone_auto: true },
    });
    render(<TimezoneSync />);
    await new Promise((r) => setTimeout(r, 20));
    expect(updateMock).not.toHaveBeenCalled();
    expect(useAppStore.getState().userSettings.timezone).toBe("UTC");
  });

  it("treats a missing switch as automatic (existing rows)", async () => {
    useAppStore.setState({ userSettings: { timezone: "UTC" } });
    render(<TimezoneSync />);
    await waitFor(() => expect(updateMock).toHaveBeenCalled());
  });

  it("leaves a timezone the user chose by hand alone", async () => {
    useAppStore.setState({
      userSettings: { timezone: "Europe/London", timezone_auto: false },
    });
    render(<TimezoneSync />);
    await new Promise((r) => setTimeout(r, 20));
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("does nothing when they already match or settings haven't loaded", async () => {
    useAppStore.setState({ userSettings: { timezone: "Asia/Kolkata" } });
    const { unmount } = render(<TimezoneSync />);
    unmount();
    useAppStore.setState({ userSettings: {} });
    render(<TimezoneSync />);
    await new Promise((r) => setTimeout(r, 20));
    expect(updateMock).not.toHaveBeenCalled();
  });
});
