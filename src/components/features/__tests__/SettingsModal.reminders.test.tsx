import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { useAppStore } from "@/store/useAppStore";
import { SettingsModal } from "@/components/features/SettingsModal";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/do",
}));

const storedSettings = {
  user_id: "user-123",
  display_name: "Test",
  timezone: "UTC",
  theme: "warm",
  color_mode: "dark",
  reduce_motion: false,
  daily_capacity_minutes: 240,
};

const updates: Record<string, unknown>[] = [];

function query(data: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "single", "maybeSingle", "order", "in"]) {
    q[m] = vi.fn(() => q);
  }
  q.update = vi.fn((payload: Record<string, unknown>) => {
    updates.push(payload);
    return q;
  });
  q.then = (resolve: (v: unknown) => void) => resolve({ data, error: null });
  return q;
}

const mockSupabase = {
  auth: { signOut: vi.fn() },
  from: vi.fn(() => query(storedSettings)),
};

vi.mock("@/lib/supabase", () => ({ createClient: () => mockSupabase }));

const { enablePush, disablePush, sendTestPush } = vi.hoisted(() => ({
  enablePush: vi.fn(async () => "subscribed" as const),
  disablePush: vi.fn(async () => "unsubscribed" as const),
  sendTestPush: vi.fn(async () => ({ ok: true as const, sent: 1 })),
}));
vi.mock("@/lib/push", () => ({ enablePush, disablePush, sendTestPush }));

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider user={{ id: "user-123", email: "test@example.com" }}>
      <QueryClientProvider client={new QueryClient()}>
        {children}
      </QueryClientProvider>
    </SessionProvider>
  );
}

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";

describe("SettingsModal — reminders", () => {
  let permission: NotificationPermission;
  const requestPermission = vi.fn(async () => {
    permission = "granted";
    return permission;
  });

  beforeEach(() => {
    updates.length = 0;
    permission = "default";
    requestPermission.mockClear();
    enablePush.mockClear();
    sendTestPush.mockClear();
    window.matchMedia = vi.fn(() => ({ matches: false })) as never;
    vi.stubGlobal(
      "Notification",
      class {
        static get permission() {
          return permission;
        }
        static requestPermission = requestPermission;
      },
    );
    useAppStore.getState().setUserSettings({ ...storedSettings });
    useAppStore.getState().setSettingsModalOpen(true, "notifications");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reads as off until permission is granted, and asks from the tap", async () => {
    render(<SettingsModal />, { wrapper });
    const toggle = await screen.findByRole("switch", {
      name: "Reminders",
    });
    // Unset counts as on, but nothing can arrive without permission.
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await new Promise((r) => setTimeout(r, 150));

    fireEvent.click(toggle);

    expect(requestPermission).toHaveBeenCalledTimes(1);
    await waitFor(
      () =>
        expect(updates.some((u) => u.notifications_enabled === true)).toBe(
          true,
        ),
      { timeout: 3000 },
    );
    expect(toggle).toHaveAttribute("aria-checked", "true");
    // Turning reminders on subscribes this device to Web Push.
    await waitFor(() => expect(enablePush).toHaveBeenCalledTimes(1));
  });

  it("explains how to unblock on this device, and recovers once allowed", async () => {
    permission = "denied";
    render(<SettingsModal />, { wrapper });
    expect(
      await screen.findByText(/blocked notifications for Presense/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("switch", { name: "Reminders" }),
    ).not.toBeInTheDocument();

    // The user allows notifications in site settings, then taps Check again.
    permission = "granted";
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await waitFor(() => expect(enablePush).toHaveBeenCalled());
    expect(
      await screen.findByRole("switch", { name: "Reminders" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("confirms this device and can send a test", async () => {
    permission = "granted";
    useAppStore
      .getState()
      .setUserSettings({ ...storedSettings, notifications_enabled: true });
    render(<SettingsModal />, { wrapper });
    expect(await screen.findByText("On for this device.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send a test" }));
    expect(
      await screen.findByText(/Sent. It should arrive/),
    ).toBeInTheDocument();
    expect(sendTestPush).toHaveBeenCalledTimes(1);
  });

  it("tells iPhone Safari users to add Presense to the Home Screen", async () => {
    vi.stubGlobal("Notification", undefined);
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE_UA);
    render(<SettingsModal />, { wrapper });
    expect(
      await screen.findByText(/add Presense to your Home Screen/),
    ).toBeInTheDocument();
    expect(requestPermission).not.toHaveBeenCalled();
  });
});
