import { parseTaskText } from "@/lib/nlp/parse-task-text";
import type { UserSettings } from "@/store/useAppStore";

// ─── Keyword arrays (from spec Section 12.3) ────────────────────────────────

const TASK_KW = [
  "remind",
  "remember to",
  "need to",
  "have to",
  "must",
  "gotta",
  "buy",
  "call",
  "submit",
  "finish",
  "complete",
  "due",
  "deadline",
  "by friday",
  "by tomorrow",
  "by next",
  "before",
  "fix",
  "send",
  "pay",
  "book",
  "schedule",
  "prepare",
  "check",
];

const LOCATION_KW = [
  "is in",
  "is at",
  "is on",
  "are in",
  "are at",
  "are on",
  "put it",
  "put them",
  "left it",
  "left them",
  "placed",
  "stored",
  "kept",
  "found it in",
  "located in",
  "sits in",
];

const THOUGHT_KW = [
  "i think",
  "i wonder",
  "what if",
  "maybe i",
  "maybe we",
  "idea:",
  "goal:",
  "planning to",
  "i feel like",
  "i believe",
  "curious about",
  "been thinking",
  "realised",
  "realized",
];

// ─── Types ──────────────────────────────────────────────────────────────────

export type RoutedItemType = "task" | "location" | "thought" | "unknown";

export interface RoutedItem {
  type: RoutedItemType;
  title: string;
  destination: string;
  destinationId: "do" | "inbox" | "locations" | "think";
  confidence: number;
  reason: string;
  person?: string;
  deadline?: string | null;
  url?: string;
  item_name?: string;
  recurrence?: string | null;
}

export function destinationToId(
  destination: string,
): RoutedItem["destinationId"] {
  if (destination === "Do") return "do";
  if (destination === "Inbox" || destination === "Choose space...")
    return "inbox";
  if (destination.includes("Locations")) return "locations";
  if (destination === "Think") return "think";
  return "inbox";
}

export function destinationIdToLabel(
  destinationId: RoutedItem["destinationId"],
): string {
  const labels: Record<RoutedItem["destinationId"], string> = {
    do: "Do",
    inbox: "Inbox",
    locations: "Locations",
    think: "Think",
  };
  return labels[destinationId];
}

function routedItem(
  item: Omit<RoutedItem, "destinationId" | "confidence" | "reason"> &
    Partial<Pick<RoutedItem, "destinationId" | "confidence" | "reason">>,
): RoutedItem {
  return {
    ...item,
    destinationId: item.destinationId ?? destinationToId(item.destination),
    confidence: item.confidence ?? 0.72,
    reason: item.reason ?? `${item.type}_rule`,
  };
}

// ─── Main router ────────────────────────────────────────────────────────────

export async function routeCapture(
  text: string,
  userSettings: Partial<UserSettings> = {},
): Promise<RoutedItem[]> {
  const lower = text.toLowerCase().trim();
  const results: RoutedItem[] = [];

  // If smart routing is disabled, just return as Unknown (Inbox)
  if (userSettings?.smart_routing_enabled === false) {
    results.push(
      routedItem({
        type: "unknown",
        title: text,
        destination: "Inbox",
        destinationId: "inbox",
        confidence: 1,
        reason: "smart_routing_disabled",
      }),
    );
    return results;
  }

  // Split on "also", "and also", ". " for multi-item captures
  const segments = text
    .split(/\.\s+(?=[A-Z])|,?\s+(?:and also|also)\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length > 1) {
    // Recursively route each segment
    const routedSegments = await Promise.all(
      segments.map((segment) => routeCapture(segment, userSettings)),
    );
    return routedSegments.flat();
  }

  // 1. Location
  const matchedLocKw = LOCATION_KW.find((k) => lower.includes(k));
  if (matchedLocKw) {
    let itemName = "Item";
    let locationText = text;

    // Preserve original case by splitting with a case-insensitive regex
    const splitRegex = new RegExp(`\\b${matchedLocKw}\\b`, "i");
    const parts = text.split(splitRegex);

    if (parts.length > 1 && parts[0].trim().length > 0) {
      let rawItem = parts[0].trim();
      rawItem = rawItem.replace(
        /^(my|the|our|his|her|their|a|an|your)\s+/i,
        "",
      );
      if (rawItem.length > 0) {
        itemName = rawItem.charAt(0).toUpperCase() + rawItem.slice(1);
      }

      let rawLoc = parts[1].trim();
      rawLoc = rawLoc.replace(/^(my|the|our|his|her|their|a|an|your)\s+/i, "");
      if (rawLoc.length > 0) {
        locationText = rawLoc;
      }
    }

    results.push(
      routedItem({
        type: "location",
        title: locationText,
        destination: "Remember → Locations",
        destinationId: "locations",
        item_name: itemName,
        confidence: 0.86,
        reason: "location_keyword",
      }),
    );
    return results;
  }

  // 2. Task: repeats, dates and a cleaned title from the shared parser
  // (also used by the task panel, so both read text the same way).
  const parsed = await parseTaskText(text, {
    parseDates: userSettings?.nlp_date_parsing !== false,
  });

  if (
    TASK_KW.some((k) => lower.includes(k)) ||
    parsed.deadline ||
    parsed.recurrence
  ) {
    let cleanTitle = parsed.title;
    // Also strip common prefix patterns like "remind me to", "remember to"
    cleanTitle = cleanTitle.replace(
      /^(remind me to|remember to|need to|have to|must|gotta)\s+/i,
      "",
    );
    // Capitalize first letter
    if (cleanTitle.length > 0)
      cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

    results.push(
      routedItem({
        type: "task",
        title: cleanTitle || text,
        destination: "Do",
        destinationId: "do",
        deadline: parsed.deadline ? parsed.deadline.toISOString() : null,
        recurrence: parsed.recurrence,
        confidence: parsed.deadline || parsed.recurrence ? 0.9 : 0.82,
        reason: parsed.deadline
          ? "task_keyword_with_date"
          : parsed.recurrence
            ? "task_recurrence_rule"
            : "task_keyword",
      }),
    );
    return results;
  }

  // 3. Thought → Think
  if (THOUGHT_KW.some((k) => lower.includes(k))) {
    results.push(
      routedItem({
        type: "thought",
        title: text,
        destination: "Think",
        destinationId: "think",
        confidence: 0.78,
        reason: "thought_keyword",
      }),
    );
    return results;
  }

  // 4. Unknown — routes to Inbox
  results.push(
    routedItem({
      type: "unknown",
      title: text,
      destination: "Inbox",
      destinationId: "inbox",
      confidence: 0.45,
      reason: "fallback_inbox",
    }),
  );
  return results;
}
