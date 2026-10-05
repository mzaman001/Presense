import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { AnimatePresence, LazyMotion, domMax } from "framer-motion";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { useAppStore } from "@/store/useAppStore";
import { SettingsModal } from "@/components/features/SettingsModal";
import { Sheet } from "@/components/ui/Sheet";

// DynamicModals mounts each modal only while it's open, inside an
// AnimatePresence, so closing one should play its exit animation before it
// leaves the DOM. It used to vanish in the same frame: the modal dropped out
// of the tree with nothing holding it, so the exits it declares never ran.

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
};

function query(data: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "single", "maybeSingle", "order", "in"]) {
    q[m] = vi.fn(() => q);
  }
  q.update = vi.fn(() => q);
  q.then = (resolve: (v: unknown) => void) => resolve({ data, error: null });
  return q;
}

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    auth: { signOut: vi.fn() },
    from: vi.fn(() => query(storedSettings)),
  }),
}));

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider user={{ id: "user-123", email: "test@example.com" }}>
      <QueryClientProvider client={new QueryClient()}>
        <LazyMotion features={domMax}>{children}</LazyMotion>
      </QueryClientProvider>
    </SessionProvider>
  );
}

describe("modal exit animations", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn(() => ({ matches: false })) as never;
    useAppStore.getState().setUserSettings({ ...storedSettings });
  });

  it("Settings stays on screen while it animates out, then leaves", async () => {
    useAppStore.getState().setSettingsModalOpen(true);
    function Host() {
      const open = useAppStore((s) => s.isSettingsModalOpen);
      return (
        <AnimatePresence>
          {open && <SettingsModal key="settings" />}
        </AnimatePresence>
      );
    }
    render(
      <Providers>
        <Host />
      </Providers>,
    );
    await screen.findByRole("dialog", { name: "Settings" });

    act(() => useAppStore.getState().setSettingsModalOpen(false));

    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), {
      timeout: 2000,
    });
  });

  it("a Sheet removed by its parent animates out instead of vanishing", async () => {
    function Host({ show }: { show: boolean }) {
      return (
        <AnimatePresence>
          {show && (
            <Sheet key="sheet" isOpen onClose={() => {}} ariaLabel="Panel">
              content
            </Sheet>
          )}
        </AnimatePresence>
      );
    }
    const { rerender } = render(
      <Providers>
        <Host show />
      </Providers>,
    );
    await screen.findByRole("dialog", { name: "Panel" });

    rerender(
      <Providers>
        <Host show={false} />
      </Providers>,
    );

    expect(screen.getByRole("dialog", { name: "Panel" })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), {
      timeout: 2000,
    });
  });
});
