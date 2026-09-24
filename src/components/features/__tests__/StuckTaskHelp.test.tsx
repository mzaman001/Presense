import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  makeTask,
} from "@/lib/__tests__/test-utils";
import { useAppStore } from "@/store/useAppStore";
import { StuckTaskHelp } from "@/components/features/StuckTaskHelp";
import { TaskCard } from "@/components/features/TaskCard";

const db = vi.hoisted(() => ({
  updates: [] as Array<Record<string, unknown>>,
}));
vi.mock("@/lib/supabase", () => ({
  createClient: () => ({
    from: () => ({
      update: (patch: Record<string, unknown>) => {
        db.updates.push(patch);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
  safeMutate: async (fn: () => Promise<{ error: unknown }>) => {
    const { error } = await fn();
    return { success: !error };
  },
}));

const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 3_600_000).toISOString();

const stuck = makeTask({
  id: "t1",
  title: "Renew passport",
  status: "active",
  defer_count: 3,
  first_deferred_at: hoursAgo(72),
  notes: "Old note",
});

const open = () => {
  useAppStore.setState({ stuckHelpTask: stuck, activeTimer: null });
  render(<StuckTaskHelp />);
};

beforeEach(() => {
  db.updates = [];
});

describe("Stuck-task help", () => {
  it("asks what's in the way, with a reason list and quiet exits", () => {
    open();
    expect(
      screen.getByRole("heading", { name: "What's in the way?" }),
    ).toBeInTheDocument();
    for (const reason of [
      "It's too big",
      "It's unclear",
      "It's boring",
      "I'm dreading it",
      "I don't really want to",
      "I'm waiting on something",
    ]) {
      expect(
        screen.getByRole("button", { name: new RegExp(reason) }),
      ).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Not now" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Keep as is" }),
    ).toBeInTheDocument();
    // Never counts or shames.
    expect(screen.queryByText(/3 times|times/)).not.toBeInTheDocument();
  });

  it("too big: saves up to three steps, the first as the first step", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: /It's too big/ }));
    fireEvent.change(screen.getByLabelText("Step 1"), {
      target: { value: "Find the old passport" },
    });
    fireEvent.change(screen.getByLabelText("Step 2 (optional)"), {
      target: { value: "Take a photo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save steps" }));

    await waitFor(() => expect(db.updates).toHaveLength(1));
    expect(db.updates[0]).toMatchObject({
      first_step: "Find the old passport",
      subtasks: [
        { text: "Find the old passport", completed: false },
        { text: "Take a photo", completed: false },
      ],
      // A fix gives the task a fresh start.
      defer_count: 0,
      first_deferred_at: null,
    });
    await waitFor(() =>
      expect(useAppStore.getState().stuckHelpTask).toBeNull(),
    );
  });

  it("unclear: records what done looks like above the existing notes", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: /It's unclear/ }));
    fireEvent.change(screen.getByLabelText("What does done look like?"), {
      target: { value: "New passport posted" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(db.updates).toHaveLength(1));
    expect(db.updates[0].notes).toBe(
      "Done when: New passport posted\n\nOld note",
    );
  });

  it("dreading it: sets a rough first step and opens a 2-minute timer", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: /I'm dreading it/ }));
    fireEvent.click(screen.getByRole("button", { name: /Start 2 minutes/ }));
    await waitFor(() =>
      expect(useAppStore.getState().activeTimer).toMatchObject({
        taskId: "t1",
        minutes: 2,
        firstStep: "Write a rough, ugly first version",
      }),
    );
  });

  it("waiting on something: parks it until 9am on the follow-up day", async () => {
    open();
    fireEvent.click(
      screen.getByRole("button", { name: /I'm waiting on something/ }),
    );
    fireEvent.change(screen.getByLabelText("Bring it back on"), {
      target: { value: "2099-05-06" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Park it" }));
    await waitFor(() => expect(db.updates).toHaveLength(1));
    const at = new Date(db.updates[0].snoozed_until as string);
    expect([
      at.getFullYear(),
      at.getMonth(),
      at.getDate(),
      at.getHours(),
    ]).toEqual([2099, 4, 6, 9]);
  });

  it("'Not now' backs off without touching the task", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    await waitFor(() => expect(db.updates).toHaveLength(1));
    expect(Object.keys(db.updates[0]).sort()).toEqual([
      "stuck_dismissals",
      "stuck_dismissed_until",
    ]);
  });
});

describe("TaskCard link", () => {
  const renderCard = (task: ReturnType<typeof makeTask>) =>
    render(
      <TaskCard
        task={task}
        completing={null}
        completeTask={vi.fn()}
        openEditPanel={vi.fn()}
        fetchTasks={vi.fn()}
      />,
    );

  it("offers the help only on a stuck task, and opens it", () => {
    useAppStore.setState({ stuckHelpTask: null });
    renderCard(stuck);
    fireEvent.click(screen.getByRole("button", { name: "What's in the way?" }));
    expect(useAppStore.getState().stuckHelpTask?.id).toBe("t1");
  });

  it("stays out of the way on a task snoozed twice this afternoon", () => {
    renderCard(
      makeTask({
        id: "t2",
        title: "Reply to Sam",
        status: "active",
        defer_count: 2,
        first_deferred_at: hoursAgo(3),
      }),
    );
    expect(
      screen.queryByRole("button", { name: "What's in the way?" }),
    ).not.toBeInTheDocument();
  });
});
