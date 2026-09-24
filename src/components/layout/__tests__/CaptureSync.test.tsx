import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, act } from "@/lib/__tests__/test-utils";
import { TEST_USER } from "@/lib/__tests__/test-utils";
import { enqueueCapture, readOutbox } from "@/lib/capture-outbox";
import { CaptureSync } from "@/components/layout/CaptureSync";
import { sharedCaptureText } from "@/components/layout/CaptureShortcut";

const insertMock = vi.fn(async () => ({
  error: null as null | { message: string },
}));
vi.mock("@/lib/supabase", () => ({
  createClient: () => ({ from: () => ({ insert: insertMock }) }),
}));

const setOnline = (value: boolean) =>
  Object.defineProperty(navigator, "onLine", { configurable: true, value });

const task = {
  type: "task" as const,
  title: "Buy milk",
  destination: "Do",
  destinationId: "do" as const,
  confidence: 0.9,
  reason: "test",
};

describe("CaptureSync", () => {
  beforeEach(() => {
    localStorage.clear();
    insertMock.mockReset();
    insertMock.mockImplementation(async () => ({ error: null }));
    setOnline(true);
  });
  afterEach(() => setOnline(true));

  it("sends captures waiting on this device and stays out of sight when they land", async () => {
    enqueueCapture(TEST_USER.id, "Buy milk", [task]);
    render(<CaptureSync />);

    await waitFor(() => expect(readOutbox(TEST_USER.id)).toEqual([]));
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("says captures are safe on the device while offline, then syncs when back online", async () => {
    setOnline(false);
    enqueueCapture(TEST_USER.id, "Buy milk", [task]);
    render(<CaptureSync />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Offline · 1 capture saved on this device",
    );
    expect(insertMock).not.toHaveBeenCalled();

    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(readOutbox(TEST_USER.id)).toEqual([]));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a capture that keeps failing, with a retry", async () => {
    insertMock.mockImplementation(async () => ({
      error: { message: "rejected" },
    }));
    const entry = enqueueCapture(TEST_USER.id, "Buy milk", [task]);
    // Pretend earlier attempts already failed.
    localStorage.setItem(
      `presense_capture_outbox_v1:${TEST_USER.id}`,
      JSON.stringify([{ ...entry, attempts: 3 }]),
    );
    render(<CaptureSync />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "1 capture hasn't synced yet",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("sharedCaptureText", () => {
  it("joins what a share sheet sends, without repeating it", () => {
    expect(
      sharedCaptureText(
        new URLSearchParams({
          title: "Great article",
          text: "Great article",
          url: "https://example.com/a",
        }),
      ),
    ).toBe("Great article https://example.com/a");
    expect(sharedCaptureText(new URLSearchParams({ capture: "1" }))).toBe("");
  });
});
