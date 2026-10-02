import { describe, it, expect } from "vitest";
import { joinSpokenSegments, normaliseSpoken } from "@/lib/nlp/spoken";

const categories = ["Work", "Health", "Side project"];
const n = (text: string) => normaliseSpoken(text, categories);
const join = (...segments: string[]) =>
  joinSpokenSegments(segments, categories);

describe("normaliseSpoken", () => {
  it.each([
    ["finish it priority one", "finish it p1"],
    ["finish it p two", "finish it p2"],
    ["finish it priority 3", "finish it p3"],
    ["gym hashtag health", "gym #Health"],
    ["gym tag work tomorrow", "gym #Work tomorrow"],
    ["plan hashtag side project", "plan #Side-project"],
    ["call at three thirty", "call at 3:30"],
    ["call at five", "call at 5"],
    ["call at five o'clock", "call at 5"],
    ["call by eleven forty five", "call by 11:45"],
    ["call at 3 p.m.", "call at 3 pm"],
    ["call at 9 a.m. tomorrow", "call at 9 am tomorrow"],
    ["write it an hour and a half", "write it 1 hour 30 minutes"],
    ["write it for half an hour", "write it for 30 minutes"],
    ["write it two hours", "write it 2 hours"],
    ["write it thirty minutes", "write it 30 minutes"],
    ["write it forty five minutes", "write it 45 minutes"],
    [
      "pay rent on the first of every month",
      "pay rent on the 1st of every month",
    ],
    ["pay rent on the twenty third", "pay rent on the 23rd"],
  ])("%s → %s", (spoken, expected) => {
    expect(n(spoken)).toBe(expected);
  });

  it.each([
    ["urgent call the bank", "urgent call the bank"],
    ["important email boss", "important email boss"],
    ["gym hashtag cardio", "gym hashtag cardio"],
    ["the trial period ends friday", "the trial period ends friday"],
    ["read chapter one of the book", "read chapter one of the book"],
    ["review the second draft", "review the second draft"],
    ["spend half the budget", "spend half the budget"],
    ["meet at thirteen", "meet at thirteen"],
  ])("leaves %s alone", (spoken, expected) => {
    expect(n(spoken)).toBe(expected);
  });
});

describe("joinSpokenSegments", () => {
  it("breaks at a pause before a new item", () => {
    expect(join("buy milk", "call mom", "email john tomorrow")).toBe(
      "buy milk. Call mom. Email john tomorrow",
    );
  });

  it("joins a pause that doesn't start an item", () => {
    expect(join("call sarah about the", "budget for the offsite")).toBe(
      "call sarah about the budget for the offsite",
    );
    expect(join("call the dentist", "tomorrow at five")).toBe(
      "call the dentist tomorrow at 5",
    );
  });

  it("joins when the words before the pause trail off", () => {
    expect(join("remind me to", "call mom")).toBe("remind me to call mom");
  });

  it("breaks on a lead-in after a pause", () => {
    expect(join("meeting at two", "need to prepare slides")).toBe(
      "meeting at 2. Need to prepare slides",
    );
  });

  it("always breaks on a spoken 'next task'", () => {
    expect(join("buy milk next task eggs next task bread")).toBe(
      "buy milk. Eggs. Bread",
    );
    expect(join("buy milk next task", "eggs")).toBe("buy milk. Eggs");
  });

  it("breaks on 'and then' before a new item, and only then", () => {
    expect(join("buy milk and then call mom")).toBe("buy milk. Call mom");
    expect(join("wait and then decide")).toBe("wait and then decide");
  });

  it("breaks after a time said with p.m.", () => {
    expect(join("dentist at 3 p.m.", "pick up the kids")).toBe(
      "dentist at 3 pm. Pick up the kids",
    );
  });

  it("returns an empty string for silence", () => {
    expect(join()).toBe("");
    expect(join("  ", "next task")).toBe("");
  });
});
