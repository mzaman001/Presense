import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/useAppStore";

const loaded = vi.hoisted(() => vi.fn());
vi.mock("@/components/features/RitualOverlay", () => {
  loaded();
  return { RitualOverlay: () => <div data-testid="ritual">ritual</div> };
});

import { RitualOverlayDynamic } from "../RitualOverlayDynamic";

describe("RitualOverlayDynamic", () => {
  beforeEach(() => {
    loaded.mockClear();
    useAppStore.setState({ activeRitual: null });
  });

  it("renders nothing and does not load the ritual while none is active", async () => {
    const { container } = render(<RitualOverlayDynamic />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
    expect(loaded).not.toHaveBeenCalled();
  });

  it("loads and shows the ritual once one becomes active", async () => {
    render(<RitualOverlayDynamic />);
    act(() => useAppStore.setState({ activeRitual: "morning" }));
    expect(await screen.findByTestId("ritual")).toBeInTheDocument();
  });
});
