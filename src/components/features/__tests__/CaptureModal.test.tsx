import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  screen,
  fireEvent,
  waitFor,
  render,
  TEST_USER,
  act,
} from "@/lib/__tests__/test-utils";
import { readOutbox } from "@/lib/capture-outbox";
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

// Lets a test make sorting fail, as it does offline before the date parser
// has loaded.
const routing = vi.hoisted(() => ({ fail: false }));
vi.mock("@/lib/capture-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/capture-router")>();
  return {
    ...actual,
    routeCapture: (...args: Parameters<typeof actual.routeCapture>) =>
      routing.fail
        ? Promise.reject(new Error("Loading chunk failed"))
        : actual.routeCapture(...args),
  };
});

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
    // The capture outbox lives in localStorage; never carry one test's
    // pending capture into the next.
    localStorage.clear();
    routing.fail = false;
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

  // Zero-loss capture: a failed network save must neither lose the capture
  // nor stop the user. It is kept on the device for CaptureSync to retry.
  it("says saved and keeps the capture on the device when the network save fails", async () => {
    insertMock.mockImplementationOnce(async () => ({
      error: { message: "network down" },
    }));

    render(<CaptureModal />);
    typeCapture("Buy milk");
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));

    await waitFor(() =>
      expect(screen.getByText("Saved to Do")).toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(readOutbox(TEST_USER.id)).toEqual([
        expect.objectContaining({
          text: "Buy milk",
          attempts: 1,
          lastError: "network down",
        }),
      ]),
    );
  });

  it("clears the capture from the device once it reaches the database", async () => {
    render(<CaptureModal />);
    typeCapture("Buy milk");
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    // The row is sent with the id fixed at capture time, so a retry can
    // never create a second copy.
    expect(insertMock.mock.calls[0][0]).toMatchObject({
      id: expect.any(String),
      title: "Buy milk",
    });
    await waitFor(() => expect(readOutbox(TEST_USER.id)).toEqual([]));
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
  it("saves the exact words to Inbox when sorting fails, instead of stopping", async () => {
    routing.fail = true;
    render(<CaptureModal />);
    typeCapture("call the plumber about the leak");
    fireEvent.click(screen.getByRole("button", { name: /^Save/ }));

    await waitFor(() => expect(insertMock).toHaveBeenCalledTimes(1));
    expect(insertMock.mock.calls[0][0]).toMatchObject({
      title: "call the plumber about the leak",
      status: "inbox",
    });
    expect(
      screen.queryByRole("textbox", { name: "Title" }),
    ).not.toBeInTheDocument();
  });

  describe("voice", () => {
    type Handler = ((e: unknown) => void) | null;
    const instances: Array<{
      onresult: Handler;
      onend: (() => void) | null;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
    }> = [];
    class FakeRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: Handler = null;
      onerror: Handler = null;
      onend: (() => void) | null = null;
      start = vi.fn();
      stop = vi.fn(() => this.onend?.());
      abort = vi.fn();
      constructor() {
        instances.push(this);
      }
    }

    afterEach(() => {
      delete (window as unknown as Record<string, unknown>)
        .webkitSpeechRecognition;
      instances.length = 0;
    });

    it("hides the mic where the browser can't transcribe speech", () => {
      render(<CaptureModal />);
      expect(
        screen.queryByRole("button", { name: "Speak" }),
      ).not.toBeInTheDocument();
    });

    it("adds what you say after what you typed", () => {
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition =
        FakeRecognition;
      render(<CaptureModal />);
      typeCapture("Groceries:");
      fireEvent.click(screen.getByRole("button", { name: "Speak" }));

      const recognition = instances[0];
      expect(recognition.start).toHaveBeenCalled();
      expect(
        screen.getByRole("button", { name: "Stop listening" }),
      ).toHaveAttribute("aria-pressed", "true");

      act(() =>
        recognition.onresult?.({
          resultIndex: 0,
          results: [{ isFinal: true, 0: { transcript: "eggs and bread" } }],
        }),
      );
      expect(screen.getByRole("textbox", { name: "Capture" })).toHaveValue(
        "Groceries: eggs and bread",
      );

      fireEvent.click(screen.getByRole("button", { name: "Stop listening" }));
      expect(recognition.stop).toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Speak" })).toBeInTheDocument();
    });
  });
});
