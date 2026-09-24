import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, waitFor, render } from "@/lib/__tests__/test-utils";
import { useAppStore } from "@/store/useAppStore";
import { CaptureModal } from "@/components/features/CaptureModal";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

describe("CaptureModal — one-tap capture with a live preview", () => {
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

  const typeCapture = (value: string) => {
    const input = screen.getByRole("textbox", { name: "Capture" });
    fireEvent.change(input, { target: { value } });
    return input;
  };

  it("saves immediately on the primary action, without showing the review form", async () => {
    render(<CaptureModal />);
    typeCapture("Buy milk");

    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));

    // The review form's markers must never appear on the default path.
    expect(
      screen.queryByRole("textbox", { name: "Title" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Back" }),
    ).not.toBeInTheDocument();

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    expect(fromMock).toHaveBeenCalledWith("items");
    expect(insertMock.mock.calls[0][0]).toMatchObject({ title: "Buy milk" });

    await waitFor(() =>
      expect(screen.getByText("Saved to Do")).toBeInTheDocument(),
    );
  });

  it("saves immediately when Enter is pressed, matching the button's fast path", async () => {
    render(<CaptureModal />);
    const input = typeCapture("Buy milk");
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByRole("textbox", { name: "Title" }),
    ).not.toBeInTheDocument();
  });

  it("refreshes the task lists itself instead of waiting for Realtime", async () => {
    // Our own Realtime echo is ignored inside the echo window, so a capture
    // that relied on it could sit missing from Do until a later refetch.
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    render(
      <QueryClientProvider client={queryClient}>
        <CaptureModal />
      </QueryClientProvider>,
    );
    typeCapture("Buy milk");
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith(
        { queryKey: ["tasks"] },
        { cancelRefetch: false },
      ),
    );
  });

  it("opens the review form instead of saving on 'Review first'", async () => {
    render(<CaptureModal />);
    typeCapture("Buy milk");

    fireEvent.click(screen.getByRole("button", { name: "Review first" }));

    const title = await screen.findByRole("textbox", { name: "Title" });
    expect(title).toHaveValue("Buy milk");
    // Nothing is persisted just by opening the review form.
    expect(insertMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByText("Saved to Do")).toBeInTheDocument(),
    );
  });

  it("only inserts once when Enter fires twice in rapid succession (OS key-repeat)", async () => {
    render(<CaptureModal />);
    const input = typeCapture("Buy milk");

    // Two keydowns back to back, neither awaited: OS key-repeat on a held
    // Enter, or a fast double-tap. The re-entry guard must drop the second.
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByText("Saved to Do")).toBeInTheDocument(),
    );
  });

  it("falls back to the review form (without losing the capture) if the save fails", async () => {
    insertMock.mockImplementationOnce(async () => ({
      error: { message: "network down" },
    }));

    render(<CaptureModal />);
    typeCapture("Buy milk");
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));

    const title = await screen.findByRole("textbox", { name: "Title" });
    expect(title).toHaveValue("Buy milk");
  });

  it("previews the destination as you type and saves to an overridden space", async () => {
    render(<CaptureModal />);
    const input = typeCapture("Buy milk");

    // "buy" routes to Do; the live preview shows it before saving.
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Do" })).toBeChecked(),
    );
    expect(
      screen.getByRole("button", { name: "Save to Do" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Think" }));
    expect(screen.getByRole("radio", { name: "Think" })).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Save to Think" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(fromMock).toHaveBeenCalledWith("threads"));
    expect(fromMock).not.toHaveBeenCalledWith("items");
  });

  it("switches the space with Alt+1…4 from the text field", async () => {
    render(<CaptureModal />);
    const input = typeCapture("Buy milk");
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "Do" })).toBeChecked(),
    );

    fireEvent.keyDown(input, { key: "™", code: "Digit3", altKey: true });
    expect(screen.getByRole("radio", { name: "Remember" })).toBeChecked();

    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(fromMock).toHaveBeenCalledWith("locations"));
  });
});
