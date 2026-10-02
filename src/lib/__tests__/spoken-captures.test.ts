import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { format } from "date-fns";
import { routeCapture, type RoutedItem } from "@/lib/capture-router";
import { joinSpokenSegments } from "@/lib/nlp/spoken";
import {
  SPOKEN_CAPTURES,
  SPOKEN_CATEGORIES,
  SPOKEN_NOW,
  type ExpectedItem,
} from "./fixtures/spoken-captures";

const settings = {
  nlp_date_parsing: true,
  smart_routing_enabled: true,
  do_categories: SPOKEN_CATEGORIES,
};

/** The routed item in the fixture's shape, keeping only what was expected. */
function actual(item: RoutedItem, expected: ExpectedItem): ExpectedItem {
  const out: ExpectedItem = { type: item.type, title: item.title };
  if ("due" in expected || item.deadline)
    out.due = item.deadline
      ? format(new Date(item.deadline), "yyyy-MM-dd HH:mm")
      : undefined;
  if ("recurrence" in expected || item.recurrence)
    out.recurrence = item.recurrence ?? undefined;
  if ("priority" in expected || item.priority)
    out.priority = item.priority ?? undefined;
  if ("estimateMinutes" in expected || item.estimateMinutes)
    out.estimateMinutes = item.estimateMinutes ?? undefined;
  if ("category" in expected || item.category)
    out.category = item.category ?? undefined;
  return out;
}

describe("spoken captures, end to end", () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SPOKEN_NOW);
  });
  afterAll(() => vi.useRealTimers());

  it.each(SPOKEN_CAPTURES.map((c) => [c.segments.join(" | "), c] as const))(
    "%s",
    async (_, { segments, items }) => {
      const text = joinSpokenSegments(segments, SPOKEN_CATEGORIES);
      const routed = await routeCapture(text, settings);
      expect(routed.map((r, i) => actual(r, items[i] ?? r))).toEqual(items);
    },
  );
});
