import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, render } from "@/lib/__tests__/test-utils";
import { useAppStore } from "@/store/useAppStore";
import { CaptureModal } from "@/components/features/CaptureModal";

// CaptureModal reaches for a Supabase client on render via createClient().
// insertMock lets each test assert what was persisted and, when set to
// reject, exercise the save-failure fallback path.
const insertMock = vi.fn(
  async (
    _payload: Record<string, unknown>,
  ): Promise<{ error: { message: string } | null }> => ({
    error: null,
  }),
);
const fromMock = vi.fn(() => ({ insert: insertMock }));

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => ({
    from: fromMock,
  })),
}));

describe("CaptureModal — task 2.6b one-tap capture default", () => {
  beforeEach(() => {
    insertMock.mockClear();
    fromMock.mockClear();
    insertMock.mockImplementation(async () => ({ error: null }));
    useAppStore.setState({
      isCaptureModalOpen: true,
      captureModalPrefill: null,
      userSettings: {},
    });

    // handleQuickCapture/handleConfirm schedule a real 800ms setTimeout to
    // auto-close the modal after a successful save. Under a full-suite run
    // with real timers, a straggling timeout from one test can fire mid-way
    // through a LATER test and unmount its component or clobber a
    // mockImplementationOnce that test set up for itself — this is what
    // made this file flaky only in `npm test`, never in isolation.
    //
    // Fake timers (with real-time auto-advance) give this suite full control
    // over that 800ms window: `waitFor` below still resolves normally
    // because shouldAdvanceTime keeps fake time moving in step with real
    // time, but afterEach can now guarantee no timer survives past its own
    // test.
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    // Flush anything still pending before restoring real timers so a
    // straggling 800ms auto-close timer can never fire during a later test.
    vi.clearAllTimers();
    vi.useRealTimers();
    useAppStore.setState({ isCaptureModalOpen: false });
  });

  it("saves immediately on the primary Capture action, without showing the review screen", async () => {
    render(<CaptureModal />);

    const input = screen.getByPlaceholderText(/Capture anything/i);
    fireEvent.change(input, {
      target: { value: "Buy milk" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Capture$/ }));

    // The review screen's markers (destination dropdown / Confirm & Save)
    // must never appear on the default path.
    expect(screen.queryByText(/AI Extracted Context/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Confirm & Save/i }),
    ).not.toBeInTheDocument();

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    expect(fromMock).toHaveBeenCalledWith("items");
    expect(insertMock.mock.calls[0][0]).toMatchObject({
      title: "Buy milk",
    });

    await waitFor(() =>
      expect(screen.getByText(/Saved!/i)).toBeInTheDocument(),
    );
  });

  it("saves immediately when Enter is pressed, matching the button's fast path", async () => {
    render(<CaptureModal />);

    const input = screen.getByPlaceholderText(/Capture anything/i);
    fireEvent.change(input, { target: { value: "Buy milk" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByRole("button", { name: /Confirm & Save/i }),
    ).not.toBeInTheDocument();
  });

  it("opens the review screen instead of saving when 'Edit before saving' is tapped", async () => {
    render(<CaptureModal />);

    const input = screen.getByPlaceholderText(/Capture anything/i);
    fireEvent.change(input, { target: { value: "Buy milk" } });

    fireEvent.click(
      screen.getByRole("button", { name: /Edit before saving/i }),
    );

    await waitFor(() =>
      expect(screen.getByText(/AI Extracted Context/i)).toBeInTheDocument(),
    );
    // Nothing is persisted just by opening the review screen.
    expect(insertMock).not.toHaveBeenCalled();

    const confirmButton = await screen.findByRole("button", {
      name: /Confirm & Save/i,
    });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByText(/Saved!/i)).toBeInTheDocument(),
    );
  });

  it("only inserts once when Enter fires twice in rapid succession (OS key-repeat)", async () => {
    render(<CaptureModal />);

    const input = screen.getByPlaceholderText(/Capture anything/i);
    fireEvent.change(input, { target: { value: "Buy milk" } });

    // Fire two Enter keydowns back to back, neither awaited, simulating
    // OS key-repeat on a held Enter key or a fast double-tap. Without the
    // `if (isCapturing) return;` guard at the top of handleQuickCapture,
    // the second keydown would race the first's async routeCapture/insert
    // call and produce a duplicate insert.
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByText(/Saved!/i)).toBeInTheDocument(),
    );
  });

  it("falls back to the review screen (without losing the capture) if the quick-save insert fails", async () => {
    insertMock.mockImplementationOnce(async () => ({
      error: { message: "network down" },
    }));

    render(<CaptureModal />);

    const input = screen.getByPlaceholderText(/Capture anything/i);
    fireEvent.change(input, { target: { value: "Buy milk" } });
    fireEvent.click(screen.getByRole("button", { name: /^Capture$/ }));

    await waitFor(() =>
      expect(screen.getByText(/AI Extracted Context/i)).toBeInTheDocument(),
    );
    // The routed title survives into the review screen (as the chip's own
    // editable title field) so the user can retry rather than having their
    // capture silently disappear.
    // The Sheet renders into document.body (a portal), not the container.
    const chipTitleInput = document.body.querySelector(".input-title");
    expect(chipTitleInput).toHaveValue("Buy milk");
  });
});
