import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@/lib/__tests__/test-utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PomodoroTimer } from "@/components/features/PomodoroTimer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileDrawer } from "../MobileDrawer";
import { useAppStore } from "@/store/useAppStore";

const navigation = vi.hoisted(() => ({ pathname: "/remember/locations" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("@/components/providers/RealtimeProvider", () => ({
  markMutation: vi.fn(),
}));
vi.mock("@/components/layout/Navigation", () => ({
  avatarAccentFallback: () => "#9c4a2e",
}));

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
  safeMutate: vi.fn(async () => ({ success: true })),
}));

let media: MediaQueryList;
let listeners: Set<(event: MediaQueryListEvent) => void>;

beforeEach(() => {
  navigation.pathname = "/remember/locations";
  listeners = new Set();
  media = {
    matches: false,
    media: "(min-width: 48rem)",
    addEventListener: vi.fn((_, listener) => listeners.add(listener)),
    removeEventListener: vi.fn((_, listener) => listeners.delete(listener)),
  } as unknown as MediaQueryList;
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media),
  );
  useAppStore.setState({
    isMobileDrawerOpen: false,
    isCaptureModalOpen: false,
    isSearchModalOpen: false,
    isSettingsModalOpen: false,
    activeTimer: null,
    userSettings: { display_name: "Alex", email: "alex@example.com" },
  });
});

afterEach(() => {
  cleanup();
  localStorage.removeItem("pomodoro_state");
  vi.unstubAllGlobals();
});

function openDrawer(withTimer = false) {
  const view = render(
    <>
      <button
        id="mobile-nav-trigger"
        onClick={() => useAppStore.getState().setIsMobileDrawerOpen(true)}
      >
        Open navigation
      </button>
      <MobileDrawer />
      {withTimer && (
        <QueryClientProvider client={new QueryClient()}>
          <PomodoroTimer />
        </QueryClientProvider>
      )}
    </>,
  );
  const trigger = screen.getByRole("button", { name: "Open navigation" });
  trigger.focus();
  fireEvent.click(trigger);
  return { ...view, trigger };
}

describe("MobileDrawer", () => {
  it("opens a named dialog with the complete navigation and a current destination", () => {
    openDrawer();
    expect(screen.getByRole("dialog", { name: "Navigation" })).toHaveAttribute(
      "id",
      "mobile-navigation",
    );
    expect(screen.getByRole("link", { name: "Remember" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    for (const name of ["Home", "Inbox", "Do", "Think", "Trash"]) {
      expect(screen.getByRole("link", { name })).toBeVisible();
    }
    for (const name of [
      "Capture",
      "Search",
      "Focus",
      "Settings",
      "Account settings",
    ]) {
      expect(screen.getByRole("button", { name })).toBeVisible();
    }
    expect(
      screen.getByRole("button", { name: "Close navigation menu" }),
    ).toHaveFocus();
    expect(document.body).toHaveAttribute("data-scroll-locked");
  });

  it("closes with Escape and restores focus to the external trigger", async () => {
    const { trigger } = openDrawer();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(document.body).not.toHaveAttribute("data-scroll-locked");
  });

  it("keeps keyboard focus within the drawer", () => {
    const { trigger } = openDrawer();
    trigger.focus();
    expect(screen.getByRole("dialog")).toContainElement(
      document.activeElement as HTMLElement,
    );
    const account = screen.getByRole("button", { name: "Account settings" });
    account.focus();
    fireEvent.keyDown(account, { key: "Tab" });
    expect(
      screen.getByRole("button", { name: "Close navigation menu" }),
    ).toHaveFocus();
  });

  it("closes when the pathname changes", async () => {
    const view = openDrawer();
    navigation.pathname = "/think";
    view.rerender(
      <>
        <button id="mobile-nav-trigger">Open navigation</button>
        <MobileDrawer />
      </>,
    );
    await waitFor(() =>
      expect(useAppStore.getState().isMobileDrawerOpen).toBe(false),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on desktop and removes its breakpoint listener", async () => {
    const view = openDrawer();
    act(() => {
      Object.defineProperty(media, "matches", { value: true });
      listeners.forEach((listener) =>
        listener({ matches: true } as MediaQueryListEvent),
      );
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(useAppStore.getState().isMobileDrawerOpen).toBe(false);
    view.unmount();
    expect(listeners.size).toBe(0);
  });

  it.each(["Capture", "Search", "Settings", "Account settings"])(
    "hands off to %s without restoring hamburger focus",
    async (name) => {
      const { trigger } = openDrawer();
      const focus = vi.spyOn(trigger, "focus");
      fireEvent.click(screen.getByRole("button", { name }));
      await waitFor(() => {
        const state = useAppStore.getState();
        expect(state.isMobileDrawerOpen).toBe(false);
        expect(
          name === "Capture"
            ? state.isCaptureModalOpen
            : name === "Search"
              ? state.isSearchModalOpen
              : state.isSettingsModalOpen,
        ).toBe(true);
      });
      expect(focus).not.toHaveBeenCalled();
      if (name === "Account settings")
        expect(useAppStore.getState().settingsActiveTab).toBe("account");
    },
  );

  it("hands focus from navigation to the timer without restoring hamburger focus", async () => {
    const { trigger } = openDrawer(true);
    const focus = vi.spyOn(trigger, "focus");
    const navigationAtTimerOpen: boolean[] = [];
    const unsubscribe = useAppStore.subscribe((state, previous) => {
      if (state.activeTimer && !previous.activeTimer) {
        navigationAtTimerOpen.push(
          document.getElementById("mobile-navigation") !== null,
        );
      }
    });
    try {
      fireEvent.click(screen.getByRole("button", { name: "Focus" }));
      await waitFor(() =>
        expect(useAppStore.getState().activeTimer).toEqual({
          taskTitle: "Focus Session",
        }),
      );
      expect(navigationAtTimerOpen).toEqual([false]);
      expect(useAppStore.getState().isMobileDrawerOpen).toBe(false);
      const timer = screen.getByRole("dialog", { name: "Focus session" });
      await waitFor(() =>
        expect(
          // The timer opens ready; its primary control is Start.
          screen.getByRole("button", { name: /^Start/ }),
        ).toHaveFocus(),
      );
      expect(timer).toContainElement(document.activeElement as HTMLElement);
      expect(focus).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });
});
