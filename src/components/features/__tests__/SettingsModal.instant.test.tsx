import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { useAppStore } from "@/store/useAppStore";
import { SettingsModal } from "@/components/features/SettingsModal";

// Settings used to show a spinner on every open while it re-read
// user_settings, although the store already held the same row (seeded from
// the server, kept current by the app's own writes). It now opens with the
// store's copy and refreshes in the background, without overwriting edits,
// saving anything it didn't change, or re-rendering the shell for nothing.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/do",
}));

const stored = {
  user_id: "user-123",
  display_name: "Test",
  timezone: "UTC",
  theme: "warm",
  color_mode: "dark",
  reduce_motion: false,
};

const updates: Record<string, unknown>[] = [];
let respond: (data: unknown) => void = () => {};

function query() {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "single", "maybeSingle", "order", "in"]) {
    q[m] = vi.fn(() => q);
  }
  q.update = vi.fn((payload: Record<string, unknown>) => {
    updates.push(payload);
    return {
      eq: () => Promise.resolve({ data: null, error: null }),
    };
  });
  // The settings read resolves only when a test calls respond().
  const pending = new Promise((resolve) => {
    respond = (data) => resolve({ data, error: null });
  });
  q.then = (resolve: (v: unknown) => void) => pending.then(resolve);
  return q;
}

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({ auth: { signOut: vi.fn() }, from: vi.fn(query) }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider user={{ id: "user-123", email: "test@example.com" }}>
      <QueryClientProvider client={new QueryClient()}>
        {children}
      </QueryClientProvider>
    </SessionProvider>
  );
}

const nameInput = () =>
  screen.getByPlaceholderText("Your name") as HTMLInputElement;
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

describe("SettingsModal — opens with the settings it already has", () => {
  beforeEach(() => {
    updates.length = 0;
    window.matchMedia = vi.fn(() => ({ matches: false })) as never;
    localStorage.clear();
    useAppStore.getState().setUserSettings({ ...stored });
    useAppStore.getState().setSettingsModalOpen(true, "account");
  });

  it("shows the stored settings at once, before the refresh returns", () => {
    render(<SettingsModal />, { wrapper });
    expect(nameInput().value).toBe("Test");
  });

  it("leaves the store alone when the refresh finds nothing new", async () => {
    render(<SettingsModal />, { wrapper });
    const before = useAppStore.getState().userSettings;
    await act(async () => respond({ ...stored }));
    await wait(1500);
    expect(useAppStore.getState().userSettings).toBe(before);
    expect(updates).toEqual([]);
  });

  it("shows a change made elsewhere, without saving it back", async () => {
    render(<SettingsModal />, { wrapper });
    await act(async () => respond({ ...stored, display_name: "Remote" }));
    await waitFor(() => expect(nameInput().value).toBe("Remote"));
    expect(useAppStore.getState().userSettings.display_name).toBe("Remote");
    await wait(1500);
    expect(updates).toEqual([]);
  });

  it("keeps an edit made before the refresh returns", async () => {
    render(<SettingsModal />, { wrapper });
    fireEvent.change(nameInput(), { target: { value: "Mine" } });
    await act(async () => respond({ ...stored, display_name: "Remote" }));
    await wait(50);
    expect(nameInput().value).toBe("Mine");
    await waitFor(
      () => expect(updates.some((u) => u.display_name === "Mine")).toBe(true),
      { timeout: 3000 },
    );
  });

  it("still waits for the database when the store has no settings yet", async () => {
    useAppStore.getState().setUserSettings({});
    render(<SettingsModal />, { wrapper });
    expect(screen.queryByPlaceholderText("Your name")).toBeNull();
    await act(async () => respond({ ...stored }));
    await waitFor(() => expect(nameInput().value).toBe("Test"));
  });
});
