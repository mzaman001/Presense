import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  pushPayload,
  pushTopic,
  reminderMessage,
} from "../../../supabase/functions/_shared/push-payload";

const TASK_ID = "3f6c1a2e-9b7d-4e21-8c3a-5d0f9e8b7a61";

describe("push reminder copy", () => {
  it("names the task and leads with its first step", () => {
    const m = reminderMessage({
      kind: "task",
      user_id: "u",
      item_id: TASK_ID,
      title: "Write the grant intro",
      first_step: "open the draft",
    });
    expect(m.title).toBe("Write the grant intro");
    expect(m.body).toBe("Ready when you are: open the draft");
    expect(m.path).toBe(`/do?remind=${TASK_ID}`);
    expect(m.tag).toBe(`task-${TASK_ID}`);
  });

  it("never counts overdue work or mentions a miss", () => {
    for (const kind of ["task", "ritual_morning", "ritual_evening"] as const) {
      const m = reminderMessage({
        kind,
        user_id: "u",
        item_id: TASK_ID,
        title: "Call the bank",
        first_step: null,
      });
      expect(`${m.title} ${m.body}`).not.toMatch(
        /overdue|late|missed|behind|\d+ tasks?/i,
      );
    }
  });

  it("gives both rituals one shared tag, so a new one replaces the old", () => {
    const morning = reminderMessage({
      kind: "ritual_morning",
      user_id: "u",
      item_id: null,
      title: null,
      first_step: null,
    });
    expect(morning.tag).toBe("presense-ritual");
    expect(morning.path).toBe("/");
  });

  it("clips a very long title", () => {
    const m = reminderMessage({
      kind: "task",
      user_id: "u",
      item_id: TASK_ID,
      title: "x".repeat(400),
      first_step: null,
    });
    expect(m.title.length).toBeLessThanOrEqual(120);
  });
});

describe("push payload", () => {
  const message = reminderMessage({
    kind: "task",
    user_id: "u",
    item_id: TASK_ID,
    title: "Call the bank",
    first_step: null,
  });

  it("is Safari's declarative format with an absolute link on our origin", () => {
    const p = pushPayload(message, "https://getpresense.vercel.app");
    expect(p.web_push).toBe(8030);
    expect(p.notification.navigate).toBe(
      `https://getpresense.vercel.app/do?remind=${TASK_ID}`,
    );
  });

  it("falls back to a path when the origin is missing or odd", () => {
    expect(pushPayload(message, null).notification.navigate).toBe(
      `/do?remind=${TASK_ID}`,
    );
    expect(
      pushPayload(message, "javascript:alert(1)").notification.navigate,
    ).toBe(`/do?remind=${TASK_ID}`);
  });

  it("stays well under the 4 KB push payload limit", () => {
    const long = reminderMessage({
      kind: "task",
      user_id: "u",
      item_id: TASK_ID,
      title: "é".repeat(500),
      first_step: "ü".repeat(500),
    });
    const bytes = new TextEncoder().encode(
      JSON.stringify(pushPayload(long, "https://example.app")),
    ).length;
    expect(bytes).toBeLessThan(3000);
  });

  it("uses a 32-char topic so a newer undelivered push replaces the older", () => {
    const topic = pushTopic(message);
    expect(topic).toBe(TASK_ID.replace(/-/g, ""));
    expect(topic).toHaveLength(32);
    expect(topic).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("push_reminders scheduler gate", () => {
  it("refuses every call without the cron secret (no JWT fallback)", () => {
    const src = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../../supabase/functions/push_reminders/index.ts",
      ),
      "utf8",
    );
    expect(src).toContain(
      '!cronSecret || req.headers.get("x-cron-secret") !== cronSecret',
    );
    expect(src).toContain("CRON_AUTH_FAILED");
  });
});

describe("claim_push_reminders", () => {
  // The function's current definition is the newest migration that
  // (re)creates it; task reminders must wait for a device rather than be
  // used up when the user has nowhere to receive them.
  it("only claims a task reminder once the user has a device", () => {
    const dir = path.resolve(__dirname, "../../../supabase/migrations");
    const latest = fs
      .readdirSync(dir)
      .filter((f) =>
        fs
          .readFileSync(path.join(dir, f), "utf8")
          .includes("create or replace function public.claim_push_reminders()"),
      )
      .sort()
      .at(-1)!;
    const sql = fs.readFileSync(path.join(dir, latest), "utf8");
    const taskBranch = sql.slice(
      sql.indexOf("with due as"),
      sql.indexOf("returning 'task'"),
    );
    expect(taskBranch).toMatch(
      /and exists \(select 1 from public\.push_subscriptions p where p\.user_id = i\.user_id\)/,
    );
  });
});
