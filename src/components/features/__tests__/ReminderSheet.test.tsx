import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReminderSheet } from "@/components/features/ReminderSheet";
import { RemindMeChip } from "@/components/features/RemindMeChip";
import { useAppStore } from "@/store/useAppStore";
import { makeTask } from "@/lib/__tests__/test-utils";

const { updates } = vi.hoisted(() => ({
  updates: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    from: () => ({
      update: (patch: Record<string, unknown>) => {
        updates.push(patch);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));

function wrap(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>,
  );
}

describe("ReminderSheet", () => {
  beforeEach(() => {
    updates.length = 0;
    useAppStore.setState({ activeTimer: null });
    useAppStore.getState().setUserSettings({
      nudge_time: "09:00:00",
      shutdown_time: "18:00:00",
    });
  });

  const task = makeTask({
    id: "t1",
    title: "Write the grant intro",
    first_step: "open the draft",
    status: "active",
  });

  it("leads with the task and its first step, and Start opens focus", () => {
    const onClose = vi.fn();
    wrap(<ReminderSheet task={task} onClose={onClose} />);
    expect(screen.getByText("Write the grant intro")).toBeInTheDocument();
    expect(screen.getByText(/open the draft/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Start/ }));
    expect(useAppStore.getState().activeTimer).toEqual({
      taskId: "t1",
      taskTitle: "Write the grant intro",
      firstStep: "open the draft",
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("Later moves the reminder and snoozes the task to the same time", async () => {
    wrap(<ReminderSheet task={task} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Tomorrow morning/ }));
    await waitFor(() => expect(updates).toHaveLength(1));
    const patch = updates[0];
    expect(patch.remind_at).toBe(patch.snoozed_until);
    const at = new Date(patch.remind_at as string);
    expect(at.getHours()).toBe(9);
    expect(at.getMinutes()).toBe(0);
  });
});

describe("RemindMeChip", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sets a preset time and can clear it", async () => {
    vi.stubGlobal("Notification", { permission: "granted" });
    const onChange = vi.fn();
    const { rerender } = render(
      <RemindMeChip value="" onChange={onChange} settings={{}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Remind me/ }));
    fireEvent.click(await screen.findByRole("button", { name: "In an hour" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    );

    rerender(
      <RemindMeChip
        value="2030-01-02T09:30"
        onChange={onChange}
        settings={{}}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "No reminder" }));
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("says so when reminders can't reach this device", async () => {
    vi.stubGlobal("Notification", { permission: "default" });
    render(<RemindMeChip value="" onChange={vi.fn()} settings={{}} />);
    fireEvent.click(screen.getByRole("button", { name: /Remind me/ }));
    expect(
      await screen.findByText(/Reminders are off on this device/),
    ).toBeInTheDocument();
  });
});
