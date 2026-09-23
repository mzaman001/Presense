import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileTopBar } from "../MobileTopBar";
import { useAppStore } from "@/store/useAppStore";

const inbox = vi.hoisted(() => ({
  data: undefined as number | undefined,
  isError: false,
  isPending: true,
  refetch: vi.fn(),
}));
vi.mock("@/hooks/useInboxCount", () => ({ useInboxCount: () => inbox }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/remember/locations",
}));
vi.mock("@/components/providers/RealtimeProvider", () => ({
  markMutation: vi.fn(),
}));
vi.mock("@/components/layout/Navigation", () => ({
  avatarAccentFallback: () => "#9c4a2e",
}));

beforeEach(() => {
  inbox.data = undefined;
  inbox.isError = false;
  inbox.isPending = true;
  inbox.refetch.mockReset();
  useAppStore.setState({
    isMobileDrawerOpen: false,
    isSearchModalOpen: false,
    isSettingsModalOpen: false,
    userSettings: { display_name: "Alex" },
  });
});
afterEach(cleanup);

describe("MobileTopBar", () => {
  it("exposes the external dialog trigger and reflects drawer state", () => {
    render(<MobileTopBar />);
    const trigger = screen.getByRole("button", {
      name: "Open navigation menu",
    });
    expect(trigger).toHaveAttribute("id", "mobile-nav-trigger");
    expect(trigger).toHaveAttribute("aria-controls", "mobile-navigation");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    act(() => useAppStore.getState().setIsMobileDrawerOpen(false));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Remember")).toBeVisible();
  });

  it("names every control and gives each a 44px minimum target", () => {
    render(<MobileTopBar />);
    for (const control of [
      ...screen.getAllByRole("button"),
      ...screen.getAllByRole("link"),
    ]) {
      expect(control).toHaveAccessibleName();
      expect(control).toHaveClass("min-h-11", "min-w-11");
    }
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(useAppStore.getState().isSearchModalOpen).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Account settings" }));
    expect(useAppStore.getState().isSettingsModalOpen).toBe(true);
    expect(useAppStore.getState().settingsActiveTab).toBe("account");
  });

  it("does not present a pending count as zero", () => {
    render(<MobileTopBar />);
    expect(
      screen.getByRole("link", { name: "Inbox, count loading" }),
    ).toHaveAttribute("href", "/inbox");
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows a bounded badge with the full count in the accessible name", () => {
    inbox.data = 123;
    inbox.isPending = false;
    render(<MobileTopBar />);
    expect(
      screen.getByRole("link", { name: "Inbox, 123 items" }),
    ).toBeVisible();
    expect(screen.getByText("99+")).toHaveAttribute("aria-hidden", "true");
  });

  it("reports count errors and offers a separate retry without losing the Inbox link", () => {
    inbox.data = 12;
    inbox.isPending = false;
    inbox.isError = true;
    render(<MobileTopBar />);
    expect(
      screen.getByRole("link", { name: "Inbox, count unavailable" }),
    ).toHaveAttribute("href", "/inbox");
    expect(screen.queryByText("12")).not.toBeInTheDocument();
    const retry = screen.getByRole("button", {
      name: "Inbox count unavailable. Retry",
    });
    expect(retry.closest("a")).toBeNull();
    fireEvent.click(retry);
    expect(inbox.refetch).toHaveBeenCalledOnce();
  });
});
