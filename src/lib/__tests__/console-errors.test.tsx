import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAppStore } from "@/store/useAppStore";
import { RitualOverlay } from "@/components/features/RitualOverlay";
import { SearchModal } from "@/components/features/SearchModal";
import { CaptureModal } from "@/components/features/CaptureModal";
import { SettingsModal } from "@/components/features/SettingsModal";

// ─── Router mock ──────────────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/do",
}));

// ─── react-textarea-autosize mock (jsdom) ─────────────────────────────────────
vi.mock("react-textarea-autosize", () => ({
  default: React.forwardRef<
    HTMLTextAreaElement,
    React.ComponentProps<"textarea"> & { minRows?: number; maxRows?: number }
  >(function TextareaAutosizeMock({ minRows, maxRows, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        data-minrows={minRows}
        data-maxrows={maxRows}
        {...props}
      />
    );
  }),
}));

// ─── Supabase mock ────────────────────────────────────────────────────────────
const networkError = new TypeError("Failed to fetch");

const mockSupabase = {
  auth: { getUser: vi.fn(), signOut: vi.fn() },
  from: vi.fn(),
  channel: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  removeChannel: vi.fn(),
};

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => mockSupabase),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

function chainableQuery(data: unknown = null, error: unknown = null) {
  const query: Record<string, unknown> = {
    select: vi.fn().mockImplementation(() => query),
    eq: vi.fn().mockImplementation(() => query),
    in: vi.fn().mockImplementation(() => query),
    or: vi.fn().mockImplementation(() => query),
    limit: vi.fn().mockImplementation(() => query),
    gte: vi.fn().mockImplementation(() => query),
    single: vi.fn().mockImplementation(() => query),
    maybeSingle: vi.fn().mockImplementation(() => query),
    then: vi.fn().mockImplementation((resolve) => resolve({ data, error })),
  };
  return query;
}

describe("Console error regression — network failures and render-phase state", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let unhandledSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Catch React's console.error (used to assert "no warning")
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Catch unhandled rejections the app may emit
    unhandledSpy = vi.fn();
    process.on("unhandledRejection", unhandledSpy);
    window.addEventListener("unhandledrejection", unhandledSpy);

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((q: string) => ({
        matches: false,
        media: q,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    useAppStore.setState({
      isCaptureModalOpen: false,
      isSearchModalOpen: false,
      isSettingsModalOpen: false,
      captureModalPrefill: null,
      activeRitual: null,
      userSettings: {
        theme: "orange",
        color_mode: "dark",
        nudge_time: "08:00",
        shutdown_time: "18:00",
        daily_capacity_minutes: 240,
      },
      lastMutations: {},
      prefetchedThreads: {},
    });
  });

  afterEach(() => {
    process.off("unhandledRejection", unhandledSpy);
    window.removeEventListener("unhandledrejection", unhandledSpy);
    vi.useRealTimers();
  });

  describe("RitualOverlay — network failure during ritual data fetch", () => {
    it("must not produce an unhandled 'Failed to fetch' rejection when getUser rejects", async () => {
      vi.useRealTimers();
      mockSupabase.auth.getUser.mockRejectedValue(networkError);
      mockSupabase.from.mockImplementation(() => chainableQuery([]));

      render(<RitualOverlay isOpen={true} type="morning" />, { wrapper });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(unhandledSpy).not.toHaveBeenCalled();
    });

    it("must not produce an unhandled rejection when the items query fails", async () => {
      vi.useRealTimers();
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      mockSupabase.from.mockImplementation(() =>
        chainableQuery(null, networkError),
      );

      render(<RitualOverlay isOpen={true} type="evening" />, { wrapper });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(unhandledSpy).not.toHaveBeenCalled();
    });

    it("stops the loading spinner on network failure instead of hanging", async () => {
      vi.useRealTimers();
      mockSupabase.auth.getUser.mockRejectedValue(networkError);
      mockSupabase.from.mockImplementation(() => chainableQuery([]));

      render(<RitualOverlay isOpen={true} type="morning" />, { wrapper });

      await waitFor(() => {
        expect(screen.queryByText(/Preparing your ritual/i)).toBeNull();
      });
    });
  });

  describe("Dynamic modals — no render-phase state updates", () => {
    it("SearchModal must not dispatch state during render", async () => {
      vi.useRealTimers();
      // Prime the store so the modal is open at mount — exactly the case that
      // previously triggered setState() inside the render body.
      useAppStore.getState().setSearchModalOpen(true);
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      mockSupabase.from.mockImplementation(() => chainableQuery([]));

      render(<SearchModal />, { wrapper });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("hasn't mounted"),
        expect.anything(),
      );
    });

    it("CaptureModal must not dispatch state during render", async () => {
      vi.useRealTimers();
      useAppStore.getState().setCaptureModalOpen(true);
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      mockSupabase.from.mockImplementation(() => chainableQuery([]));

      render(<CaptureModal />, { wrapper });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("hasn't mounted"),
        expect.anything(),
      );
    });

    it("CaptureModal prefill must not dispatch state during render", async () => {
      vi.useRealTimers();
      useAppStore.getState().setCaptureModalOpen(true);
      useAppStore.getState().setCaptureModalPrefill("Prefilled note");
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
      });
      mockSupabase.from.mockImplementation(() => chainableQuery([]));

      render(<CaptureModal />, { wrapper });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("hasn't mounted"),
        expect.anything(),
      );
      // The prefill value should still have been applied to the input.
      expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(
        "Prefilled note",
      );
    });

    it("SettingsModal network failure during load must not emit an unhandled rejection", async () => {
      vi.useRealTimers();
      useAppStore.getState().setSettingsModalOpen(true);
      mockSupabase.auth.getUser.mockRejectedValue(networkError);
      mockSupabase.from.mockImplementation(() => chainableQuery([]));

      render(<SettingsModal />, { wrapper });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      expect(unhandledSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("hasn't mounted"),
        expect.anything(),
      );
    });
  });
});
