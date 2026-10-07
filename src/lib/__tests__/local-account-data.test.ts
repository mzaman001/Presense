import { describe, it, expect, beforeEach } from "vitest";
import { clearLocalAccountData } from "@/lib/local-account-data";

describe("clearLocalAccountData", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("presense_capture_outbox_v1:u1", "[{}]");
    localStorage.setItem("presense_capture_draft_v1:u1", "half a thought");
    localStorage.setItem("pomodoro_state", '{"taskTitle":"Private"}');
    localStorage.setItem("presense_theme", "warm");
    localStorage.setItem("presense_capture_outbox_v1:u2", "[{}]");
  });

  it("removes everything of the account when it's deleted", () => {
    clearLocalAccountData("u1", { keepUnsyncedCaptures: false });
    expect(localStorage.getItem("presense_capture_outbox_v1:u1")).toBeNull();
    expect(localStorage.getItem("presense_capture_draft_v1:u1")).toBeNull();
    expect(localStorage.getItem("pomodoro_state")).toBeNull();
    expect(localStorage.getItem("presense_theme")).toBeNull();
    // Another account on the same device is untouched.
    expect(localStorage.getItem("presense_capture_outbox_v1:u2")).toBe("[{}]");
  });

  it("keeps unsynced captures on sign-out, so they sync next time", () => {
    clearLocalAccountData("u1", { keepUnsyncedCaptures: true });
    expect(localStorage.getItem("presense_capture_outbox_v1:u1")).toBe("[{}]");
    expect(localStorage.getItem("presense_capture_draft_v1:u1")).toBeNull();
    expect(localStorage.getItem("pomodoro_state")).toBeNull();
  });
});
