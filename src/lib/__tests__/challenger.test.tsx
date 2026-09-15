import { describe, it, vi, beforeEach } from "vitest";
import { useAppStore } from "@/store/useAppStore";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/think",
}));

describe("Phase 5 Challenger - Mentions and UI Popover Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock matchMedia for jsdom
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Reset Zustand store state
    useAppStore.setState({
      isCaptureModalOpen: false,
      isSearchModalOpen: false,
      isSettingsModalOpen: false,
      userSettings: {},
    });
  });

  // Phase 5 Explore/People removal (Task 6): this suite originally covered
  // (1) extractMentions edge cases and (3) Think-space @mention/linked-people
  // aggregation on thread entries — both mechanisms were deleted outright,
  // so both describe blocks were removed along with them. No test cases
  // remain in this suite; the harness above is kept as a stub in case this
  // file is reused for other Think-page coverage later.
  it.skip("placeholder — no cases remain after Linked People removal", () => {});
});
