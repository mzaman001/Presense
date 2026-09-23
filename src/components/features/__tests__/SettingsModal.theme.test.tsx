import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
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

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider user={{ id: "user-123", email: "test@example.com" }}>
      <QueryClientProvider client={new QueryClient()}>
        {children}
      </QueryClientProvider>
    </SessionProvider>
  );
}

describe("SettingsModal — appearance persistence", () => {
  beforeEach(() => {
    updates.length = 0;
    window.matchMedia = vi.fn(() => ({ matches: false })) as never;
    localStorage.clear();
    useAppStore.getState().setUserSettings({ ...storedSettings });
    useAppStore.getState().setSettingsModalOpen(true, "appearance");
  });

  it("saves a colour-mode change and keeps it in the app store", async () => {
    render(<SettingsModal />, { wrapper });

    const light = await screen.findByRole("radio", { name: "Light" });
    // Let the post-load guard settle before changing anything.
    await new Promise((r) => setTimeout(r, 150));
    fireEvent.click(light);

    await waitFor(
      () => expect(updates.some((u) => u.color_mode === "light")).toBe(true),
      { timeout: 3000 },
    );
    // Saving must not strip fields the autosave doesn't own — AppInitializer
    // reads color_mode from the store and would fall back to "dark".
    await waitFor(() => {
      const s = useAppStore.getState().userSettings;
      expect(s.color_mode).toBe("light");
      expect(s.theme).toBe("warm");
    });
  });
});
