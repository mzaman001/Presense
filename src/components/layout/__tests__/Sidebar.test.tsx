import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "../Navigation";
import { MotionProvider } from "../MotionProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppStore } from "@/store/useAppStore";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
const inbox = vi.hoisted(() => ({
  data: 3 as number | undefined,
  isError: false,
  isPending: false,
  refetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));
vi.mock("@/hooks/useInboxCount", () => ({ useInboxCount: () => inbox }));

const initialState = useAppStore.getState();
let touchDevice = false;

beforeEach(() => {
  navigation.pathname = "/";
  inbox.data = 3;
  inbox.isError = false;
  inbox.isPending = false;
  inbox.refetch.mockReset();
  touchDevice = false;
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string): MediaQueryList => ({
      matches: query.includes("pointer: coarse")
        ? touchDevice
        : query.includes("hover: hover") || query.includes("pointer: fine")
          ? !touchDevice
          : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    })),
  );
  useAppStore.setState({
    ...initialState,
    userSettings: {
      display_name: "Alex",
      email: "alex@example.com",
      nudge_time: "09:00",
      shutdown_time: "17:00",
      last_ritual_date: "2026-09-17",
    },
    settingsActiveTab: "appearance",
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  useAppStore.setState(initialState, true);
});

function renderSidebar() {
  render(
    <MotionProvider>
      <TooltipProvider>
        <Sidebar />
        <button>Outside navigation</button>
      </TooltipProvider>
    </MotionProvider>,
  );
  return screen.getByRole("complementary", { name: "Main navigation" });
}

function advanceTime(milliseconds: number) {
  act(() => vi.advanceTimersByTime(milliseconds));
}

describe("Sidebar", () => {
  it("renders a named aside with a collapsed string state", () => {
    const sidebar = renderSidebar();
    expect(sidebar.tagName).toBe("ASIDE");
    expect(sidebar).toHaveAttribute("data-expanded", "false");
  });

  describe("pointer expansion", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 8, 17, 12));
    });

    it("opens after 100ms of mouse hover, not before", () => {
      const sidebar = renderSidebar();
      fireEvent.pointerEnter(sidebar, { pointerType: "mouse" });
      advanceTime(99);
      expect(sidebar).toHaveAttribute("data-expanded", "false");
      advanceTime(1);
      expect(sidebar).toHaveAttribute("data-expanded", "true");
    });

    it("closes 250ms after the mouse leaves, not before", () => {
      const sidebar = renderSidebar();
      fireEvent.pointerEnter(sidebar, { pointerType: "mouse" });
      advanceTime(100);
      expect(sidebar).toHaveAttribute("data-expanded", "true");
      fireEvent.pointerLeave(sidebar, { pointerType: "mouse" });
      advanceTime(249);
      expect(sidebar).toHaveAttribute("data-expanded", "true");
      advanceTime(1);
      expect(sidebar).toHaveAttribute("data-expanded", "false");
    });

    it("cancels a pending close when the mouse reenters", () => {
      const sidebar = renderSidebar();
      fireEvent.pointerEnter(sidebar, { pointerType: "mouse" });
      advanceTime(100);
      fireEvent.pointerLeave(sidebar, { pointerType: "mouse" });
      advanceTime(200);
      fireEvent.pointerEnter(sidebar, { pointerType: "mouse" });
      advanceTime(300);
      expect(sidebar).toHaveAttribute("data-expanded", "true");
      fireEvent.pointerLeave(sidebar, { pointerType: "mouse" });
      advanceTime(250);
      expect(sidebar).toHaveAttribute("data-expanded", "false");
    });

    it("cancels opening when the mouse leaves before 100ms", () => {
      const sidebar = renderSidebar();
      fireEvent.pointerEnter(sidebar, { pointerType: "mouse" });
      advanceTime(50);
      fireEvent.pointerLeave(sidebar, { pointerType: "mouse" });
      advanceTime(500);
      expect(sidebar).toHaveAttribute("data-expanded", "false");
    });

    it.each([false, true])(
      "never hover-expands for a touch pointer with coarse pointer media %s",
      (coarsePointer) => {
        touchDevice = coarsePointer;
        const sidebar = renderSidebar();
        fireEvent.pointerEnter(sidebar, { pointerType: "touch" });
        advanceTime(100);
        expect(sidebar).toHaveAttribute("data-expanded", "false");
        advanceTime(400);
        expect(sidebar).toHaveAttribute("data-expanded", "false");
        fireEvent.pointerLeave(sidebar, { pointerType: "touch" });
        advanceTime(250);
        expect(sidebar).toHaveAttribute("data-expanded", "false");
      },
    );
  });

  it("expands on focus, stays open for internal focus, and collapses on outside blur", () => {
    const sidebar = renderSidebar();
    const home = within(sidebar).getByRole("link", { name: "Home" });
    const remember = within(sidebar).getByRole("link", { name: "Remember" });
    act(() => home.focus());
    expect(home).toHaveFocus();
    expect(sidebar).toHaveAttribute("data-expanded", "true");
    act(() => remember.focus());
    expect(remember).toHaveFocus();
    expect(sidebar).toHaveAttribute("data-expanded", "true");
    act(() =>
      screen.getByRole("button", { name: "Outside navigation" }).focus(),
    );
    expect(sidebar).toHaveAttribute("data-expanded", "false");
  });

  it.each(["/remember", "/remember/locations", "/remember/locations/kitchen"])(
    "marks Remember current for %s without marking Home current",
    (pathname) => {
      navigation.pathname = pathname;
      renderSidebar();
      expect(screen.getByRole("link", { name: "Remember" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
        "aria-current",
      );
    },
  );

  it("does not mark Remember current for /remembered", () => {
    navigation.pathname = "/remembered";
    renderSidebar();
    expect(screen.getByRole("link", { name: "Remember" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks Trash current on /trash", () => {
    navigation.pathname = "/trash";
    renderSidebar();
    expect(screen.getByRole("link", { name: "Trash" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows the mocked inbox count", () => {
    renderSidebar();
    const link = screen.getByRole("link", { name: /Inbox/i });
    expect(link).toHaveAttribute("href", "/inbox");
    expect(within(link).getAllByText("3").length).toBeGreaterThan(0);
  });

  it("offers a separately named retry button when the inbox count fails", () => {
    inbox.data = undefined;
    inbox.isError = true;
    renderSidebar();
    expect(screen.getByRole("link", { name: /Inbox/i })).toHaveAttribute(
      "href",
      "/inbox",
    );
    const retry = screen.getByRole("button", { name: "Retry inbox count" });
    expect(retry).toHaveAttribute("aria-label", "Retry inbox count");
    expect(retry.closest("a")).toBeNull();
    fireEvent.click(retry);
    expect(inbox.refetch).toHaveBeenCalledOnce();
  });

  it("names the account control Account settings and opens the account tab", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: "Account settings" }));
    expect(useAppStore.getState().isSettingsModalOpen).toBe(true);
    expect(useAppStore.getState().settingsActiveTab).toBe("account");
  });

  it.each([
    { hour: 12, eveningDate: undefined, label: /Day planned/i },
    { hour: 18, eveningDate: "2026-09-17", label: /All done/i },
  ])(
    "keeps completed ritual label $label truthful on hover",
    ({ hour, eveningDate, label }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 8, 17, hour));
      useAppStore.setState({
        userSettings: {
          ...useAppStore.getState().userSettings,
          last_evening_ritual_date: eveningDate,
        },
      });
      const sidebar = renderSidebar();
      advanceTime(0);
      const completedLabels = within(sidebar)
        .getAllByText(label)
        .filter((element) => !element.closest("[aria-hidden]"));
      expect(completedLabels).not.toHaveLength(0);
      const completedLabel = completedLabels[0];
      fireEvent.pointerEnter(completedLabel, { pointerType: "mouse" });
      fireEvent.mouseEnter(completedLabel);
      advanceTime(500);
      expect(completedLabel).toHaveTextContent(label);
      expect(screen.queryByText(/Review your day/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Already done/i)).not.toBeInTheDocument();
    },
  );

  it.each([
    { hour: 12, eveningDate: undefined, label: /Day planned/i },
    { hour: 18, eveningDate: "2026-09-17", label: /All done/i },
  ])(
    "completed ritual row $label still opens manual planning on click",
    ({ hour, eveningDate }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 8, 17, hour));
      useAppStore.setState({
        userSettings: {
          ...useAppStore.getState().userSettings,
          last_evening_ritual_date: eveningDate,
        },
      });
      renderSidebar();
      advanceTime(0);
      const button = within(screen.getByRole("complementary")).getByRole(
        "button",
        { name: /day planned|all done/i },
      );
      fireEvent.click(button);
      expect(useAppStore.getState().activeRitual).toBe("morning");
    },
  );

  it("opens the evening ritual directly when the evening review is due", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 17, 18));
    useAppStore.setState({
      userSettings: {
        ...useAppStore.getState().userSettings,
        last_ritual_date: "2026-09-17",
      },
    });
    renderSidebar();
    advanceTime(0);
    const eveningButton = within(screen.getByRole("complementary")).getByRole(
      "button",
      { name: /evening review/i },
    );
    fireEvent.click(eveningButton);
    expect(useAppStore.getState().activeRitual).toBe("evening");
  });
});
