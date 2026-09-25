import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  TEST_USER,
} from "@/lib/__tests__/test-utils";
import { useAppStore } from "@/store/useAppStore";
import { RitualOverlay } from "@/components/features/RitualOverlay";
import {
  EVENING_SWEEP_CATCH_ALL,
  EVENING_SWEEP_POOL,
  eveningSweepPrompts,
} from "@/components/features/MindSweep";
import { readOutbox } from "@/lib/capture-outbox";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
}));

// A chainable Supabase double: every read resolves to `rows[table]`, and
// writes are recorded.
const db = vi.hoisted(() => ({
  rows: {} as Record<string, unknown[]>,
  updates: [] as Array<{ table: string; patch: Record<string, unknown> }>,
  inserts: [] as Array<{ table: string; row: Record<string, unknown> }>,
  reads: 0,
}));
vi.mock("@/lib/supabase", () => {
  const query = (table: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in", "gte", "lt", "order", "limit"])
      q[m] = () => q;
    q.then = (resolve: (v: unknown) => void) => {
      db.reads++;
      return resolve({ data: db.rows[table] ?? [], error: null });
    };
    q.update = (patch: Record<string, unknown>) => {
      db.updates.push({ table, patch });
      return { eq: async () => ({ error: null }) };
    };
    q.insert = async (row: Record<string, unknown>) => {
      db.inserts.push({ table, row });
      return { error: null };
    };
    return q;
  };
  return {
    createClient: () => ({ from: query }),
    safeMutate: async (fn: () => Promise<{ error: unknown }>) => {
      const { error } = await fn();
      return { success: !error };
    },
  };
});

beforeEach(() => {
  localStorage.clear();
  db.rows = {};
  db.updates = [];
  db.inserts = [];
  db.reads = 0;
  useAppStore.setState({
    userSettings: { smart_routing_enabled: true, nlp_date_parsing: true },
  });
});
afterEach(() => vi.useRealTimers());

describe("Morning: empty your head first", () => {
  it("captures each line, then shows what landed when sorting starts", async () => {
    render(<RitualOverlay isOpen={true} type="morning" />);
    const input = await screen.findByRole("textbox", {
      name: "What's on your mind?",
    });

    fireEvent.change(input, { target: { value: "Buy milk" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // Listed with where it went, and saved through the capture outbox.
    expect(await screen.findByText("Buy milk")).toBeInTheDocument();
    expect(screen.getByText("→ Do")).toBeInTheDocument();
    await waitFor(() =>
      expect(db.inserts).toEqual([
        expect.objectContaining({
          table: "items",
          row: expect.objectContaining({ title: "Buy milk" }),
        }),
      ]),
    );
    expect(readOutbox(TEST_USER.id)).toEqual([]);

    // Continue reloads, so anything that went to Inbox is there to place.
    db.rows.items = [
      { id: "new", title: "Call the plumber", status: "inbox", deadline: null },
    ];
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(await screen.findByText("Sort the loose ends.")).toBeInTheDocument();
    expect(screen.getByText("Call the plumber")).toBeInTheDocument();
  });

  it("goes straight on when nothing was added", async () => {
    render(<RitualOverlay isOpen={true} type="morning" />);
    await screen.findByText("What's on your mind?");
    const readsBefore = db.reads;
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(await screen.findByText("Sort the loose ends.")).toBeInTheDocument();
    expect(db.reads).toBe(readsBefore);
  });
});

describe("Evening", () => {
  const todayAt = (h: number) => {
    const d = new Date();
    d.setHours(h, 0, 0, 0);
    return d.toISOString();
  };

  it("asks three short, skippable questions ending with the catch-all", async () => {
    render(<RitualOverlay isOpen={true} type="evening" />);
    const section = await screen.findByRole("heading", {
      name: "Anything else on your mind?",
    });
    const prompts = eveningSweepPrompts();
    for (const prompt of prompts) {
      expect(screen.getByRole("textbox", { name: prompt })).toBeInTheDocument();
    }
    expect(prompts).toHaveLength(3);
    expect(prompts[2]).toBe(EVENING_SWEEP_CATCH_ALL);
    expect(section).toBeInTheDocument();
  });

  it("offers Tomorrow, Pick a day or Let it go for what's still open", async () => {
    db.rows.items = [
      {
        id: "t1",
        title: "Write report",
        status: "active",
        deadline: todayAt(17),
      },
    ];
    render(<RitualOverlay isOpen={true} type="evening" />);
    const group = await screen.findByRole("group", {
      name: 'What to do with "Write report"',
    });
    expect(
      within(group)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Tomorrow", "Pick a day", "Let it go"]);

    fireEvent.click(within(group).getByRole("button", { name: "Pick a day" }));
    fireEvent.change(screen.getByLabelText('Pick a day for "Write report"'), {
      target: { value: "2099-03-14" },
    });
    await waitFor(() => expect(db.updates).toHaveLength(1));
    const deadline = new Date(db.updates[0].patch.deadline as string);
    // The chosen day, keeping the task's time of day.
    expect([
      deadline.getFullYear(),
      deadline.getMonth(),
      deadline.getDate(),
    ]).toEqual([2099, 2, 14]);
    expect(deadline.getHours()).toBe(17);
  });

  it("lets a task go to Trash, with undo", async () => {
    db.rows.items = [
      { id: "t1", title: "Old idea", status: "active", deadline: todayAt(9) },
    ];
    render(<RitualOverlay isOpen={true} type="evening" />);
    const group = await screen.findByRole("group", {
      name: 'What to do with "Old idea"',
    });
    fireEvent.click(within(group).getByRole("button", { name: "Let it go" }));

    await waitFor(() =>
      expect(db.updates[0]?.patch).toMatchObject({ status: "deleted" }),
    );
    // Its row leaves "Still open" (after the exit animation). The double
    // returns every row for every query, so match the row's own controls.
    await waitFor(() =>
      expect(
        screen.queryByRole("group", { name: 'What to do with "Old idea"' }),
      ).not.toBeInTheDocument(),
    );
  });
});

describe("Morning: a realistic day", () => {
  const todayAt = (h: number) => {
    const d = new Date();
    d.setHours(h, 0, 0, 0);
    return d.toISOString();
  };
  const toShapeStep = async () => {
    render(<RitualOverlay isOpen={true} type="morning" />);
    await screen.findByText("What's on your mind?");
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await screen.findByText("Sort the loose ends.");
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await screen.findByText("Shape your day.");
  };

  beforeEach(() => {
    useAppStore.setState({ userSettings: { daily_capacity_minutes: 120 } });
    db.rows.items = [
      {
        id: "a",
        title: "Write report",
        status: "active",
        deadline: todayAt(15),
        time_estimate: 90,
      },
      {
        id: "b",
        title: "Groceries",
        status: "active",
        deadline: todayAt(18),
        time_estimate: 60,
      },
      {
        id: "c",
        title: "Call bank",
        status: "active",
        deadline: todayAt(11),
        time_estimate: null,
      },
    ];
  });

  it("measures the plan against the time you actually have today", async () => {
    await toShapeStep();
    const bar = screen.getByTestId("workload-bar");
    expect(within(bar).getByText("2h 30m")).toBeInTheDocument();
    expect(bar).toHaveTextContent("of 2h");
    expect(bar).toHaveTextContent("30m more than your day holds");
    // Unestimated tasks are called out rather than silently counted as 0.
    expect(bar).toHaveTextContent("1 task has no estimate");

    // A freer day: 30 minutes more and the plan fits with nothing over.
    fireEvent.click(screen.getByRole("button", { name: "30 minutes more" }));
    expect(screen.getByText("2h 30m", { selector: "output" })).toBeTruthy();
    expect(bar).not.toHaveTextContent("more than your day holds");
  });

  it("moves a task to tomorrow from the plan, keeping its time", async () => {
    await toShapeStep();
    fireEvent.click(
      screen.getByRole("button", { name: 'Move "Groceries" to tomorrow' }),
    );
    await waitFor(() => expect(db.updates).toHaveLength(1));
    const moved = new Date(db.updates[0].patch.deadline as string);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(moved.toDateString()).toBe(tomorrow.toDateString());
    expect(moved.getHours()).toBe(18);
    expect(screen.getByTestId("workload-bar")).toHaveTextContent(
      "30m left over",
    );
  });

  it("describes carried-over tasks neutrally, not as overdue", async () => {
    db.rows.items = [
      {
        id: "old",
        title: "Old task",
        status: "active",
        deadline: "2020-01-01T09:00:00Z",
      },
    ];
    render(<RitualOverlay isOpen={true} type="morning" />);
    await screen.findByText("What's on your mind?");
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(await screen.findByText(/From an earlier day/)).toBeInTheDocument();
    expect(screen.queryByText("Overdue")).not.toBeInTheDocument();
  });
});

describe("eveningSweepPrompts", () => {
  it("rotates two questions a day from the pool, never repeating within a day", () => {
    const seen = new Set<string>();
    for (let day = 0; day < EVENING_SWEEP_POOL.length; day++) {
      const [a, b] = eveningSweepPrompts(new Date(2026, 0, 1 + day));
      expect(a).not.toBe(b);
      seen.add(a).add(b);
    }
    // Over a week every question in the pool comes up.
    expect(seen.size).toBe(EVENING_SWEEP_POOL.length);
  });
});

describe("First run (straight from onboarding)", () => {
  const todayAt = (h: number) => {
    const d = new Date();
    d.setHours(h, 0, 0, 0);
    return d.toISOString();
  };

  beforeEach(() => {
    localStorage.setItem("presense_first_run", "1");
    useAppStore.setState({
      activeTimer: null,
      userSettings: {
        display_name: "Sam Rivera",
        smart_routing_enabled: true,
        nlp_date_parsing: true,
      },
    });
  });

  it("greets by name and needs one thing before continuing", async () => {
    render(<RitualOverlay isOpen={true} type="morning" />);
    expect(
      await screen.findByRole("heading", { name: /, Sam\.$/ }),
    ).toBeInTheDocument();
    const next = screen.getByRole("button", { name: /continue/i });
    expect(next).toBeDisabled();

    const input = screen.getByRole("textbox", { name: "What's on your mind?" });
    fireEvent.change(input, { target: { value: "Buy milk" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByText("Buy milk");
    expect(next).toBeEnabled();
  });

  it("finishes in the focus view on the task picked, and ends the first run", async () => {
    db.rows.items = [
      {
        id: "a",
        title: "Write report",
        status: "active",
        deadline: todayAt(15),
      },
      { id: "b", title: "Groceries", status: "active", deadline: todayAt(18) },
    ];
    render(<RitualOverlay isOpen={true} type="morning" />);
    const input = await screen.findByRole("textbox", {
      name: "What's on your mind?",
    });
    fireEvent.change(input, { target: { value: "Buy milk" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByText("Buy milk");
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await screen.findByText("Sort the loose ends.");
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    await screen.findByText("Shape your day.");

    // The first task is first up until another is tapped.
    const report = screen.getByRole("button", { name: /^Write report/ });
    const groceries = screen.getByRole("button", { name: /^Groceries/ });
    expect(report).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(groceries);
    expect(groceries).toHaveAttribute("aria-pressed", "true");
    expect(report).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Start my day" }));
    await waitFor(() =>
      expect(useAppStore.getState().activeTimer).toMatchObject({
        taskId: "b",
        taskTitle: "Groceries",
      }),
    );
    expect(localStorage.getItem("presense_first_run")).toBeNull();
  });
});
