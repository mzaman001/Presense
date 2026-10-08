import { DEFAULT_DO_CATEGORIES } from "@/lib/constants";
import { parseTaskText, stripLeadIn } from "@/lib/nlp/parse-task-text";
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

/**
 * Verbs that start a to-do ("email Sarah", "renew car insurance"). Only
 * checked at the start, after lead-ins like "please" or "don't forget to",
 * so "I think we should call it Presense" isn't one.
 */
const TASK_VERBS = [
  "email",
  "e-mail",
  "text",
  "ring",
  "phone",
  "call",
  "message",
  "msg",
  "reply",
  "respond",
  "ask",
  "tell",
  "invite",
  "remind",
  "follow up",
  "chase",
  "contact",
  "pick up",
  "drop off",
  "collect",
  "renew",
  "cancel",
  "return",
  "order",
  "buy",
  "get",
  "grab",
  "pay",
  "book",
  "schedule",
  "reschedule",
  "arrange",
  "organise",
  "organize",
  "plan",
  "prep",
  "prepare",
  "clean",
  "tidy",
  "wash",
  "hoover",
  "vacuum",
  "do",
  "make",
  "write",
  "draft",
  "edit",
  "review",
  "read",
  "watch",
  "listen to",
  "research",
  "look into",
  "look up",
  "find",
  "fix",
  "repair",
  "replace",
  "install",
  "update",
  "upgrade",
  "set up",
  "sort",
  "file",
  "print",
  "sign",
  "post",
  "mail",
  "send",
  "submit",
  "finish",
  "complete",
  "start",
  "check",
  "confirm",
  "visit",
  "go",
  "take",
  "bring",
  "water",
  "feed",
  "walk",
  "cook",
  "bake",
  "practise",
  "practice",
  "study",
  "learn",
  "apply",
  "register",
  "sign up",
  "upload",
  "download",
  "back up",
  "backup",
  "move",
  "pack",
  "unpack",
  "donate",
  "sell",
  "clear",
  "empty",
  "change",
  "charge",
  "top up",
  "transfer",
  "meet",
  "see",
  "try",
  "test",
  "put",
  "hang",
  "turn",
  "switch",
  "add",
  "look at",
  "open",
  "lock",
  "unlock",
  "remove",
  "delete",
  "share",
  "plant",
  "run",
  "wrap",
  "iron",
  "mow",
  "declutter",
  "defrost",
];

const escapeRegExp = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Whole words only: "must" shouldn't match "mustard", nor "book" "notebook". */
const words = (list: string[]) =>
  new RegExp(`\\b(?:${list.map(escapeRegExp).join("|")})(?![\\w'’-])`, "i");
const TASK_RE = words(TASK_KW);
export const TASK_VERB_RE = new RegExp(`^${words(TASK_VERBS).source}`, "i");
const THOUGHT_RE = words(THOUGHT_KW);
const LOCATION_RE = words(LOCATION_KW);
// "this is in progress": a pronoun isn't a thing you put somewhere.
const NOT_AN_ITEM =
  /^(?:this|that|it|everything|nothing|something|there|here|he|she|they|we|i|you|which|what|who)$/i;
// "Do I need a visa?" asks rather than instructs.
const QUESTION =
  /^(?:do|does|did|can|could|should|would|will|is|are|am|was|were|have|has|shall|may|might)\s+(?:i|we|you|they|he|she|it|there)\b/i;

// A full stop starts a new item, except after "Dr." and friends.
// Case-sensitive on purpose: only a capital after the full stop starts a
// new item ("meet at 5 p.m. tomorrow" is one).
const SENTENCE_BREAK =
  /(?<!\b(?:[Dd]r|[Mm]rs?|[Mm][sx]|[Ss]t|[Pp]rof|[Ss]r|[Jj]r|vs|etc|approx|[Nn]o|e\.g|i\.e|[ap]\.m))\.\s+(?=[A-Z])/;
const ALSO = /(,?\s+(?:and\s+)?also\s+)/i;
// "I also need to…", "we should also…": the words before "also" aren't an
// item of their own.
export const INCOMPLETE_END =
  /\b(?:i|we|you|they|he|she|it|should|could|would|will|can|must|might|may|to|and|or|but)$/i;

/** One capture can hold several items: "Buy milk. Call mom", "…also…". */
function splitCapture(text: string): string[] {
  return text.split(SENTENCE_BREAK).flatMap((sentence) => {
    const [first, ...rest] = sentence.split(ALSO);
    const items = [first];
    for (let i = 0; i < rest.length; i += 2) {
      const sep = rest[i];
      const next = rest[i + 1] ?? "";
      const prev = items[items.length - 1];
      const startsItem =
        TASK_VERB_RE.test(stripLeadIn(next)) ||
        stripLeadIn(next) !== next.trim();
      if (startsItem && !INCOMPLETE_END.test(prev.trim())) items.push(next);
      else items[items.length - 1] = prev + sep + next;
    }
    return items.map((t) => t.trim()).filter(Boolean);
  });
}
// A thought label up front wins even when a task verb follows it.
export const THOUGHT_LEAD =
  /^(?:(?:idea|thought|shower thought|random idea)\s*[:\-–]|(?:shower thought|what if|i wonder)\b)/i;

// "I left my keys in the kitchen drawer", "stashed the cash under the bed".
// Imperative "put ..." needs the "I" ("put up shelves in the lounge").
export const PUT_AWAY =
  /^(?:i\s+(?:just\s+)?(?:left|put|placed|stored|kept|hid|stashed)|i(?:['’]ve|\s+have)\s+(?:left|put|placed|stored|kept|hidden|stashed)|(?:left|placed|stored|hid|stashed))\s+(?:(?:my|the|our|his|her|their|a|an|your)\s+)?(.+?)\s+(in|on|at|under|behind|inside|beside|next\s+to|by)\s+(.+)$/i;
const ARTICLE = /^(my|the|our|his|her|their|a|an|your)\s+/i;

const capitalise = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

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
  /** 1 = urgent … 4 = low, from an explicit "p1" / "!!" marker. */
  priority?: 1 | 2 | 3 | 4 | null;
  estimateMinutes?: number | null;
  /** One of the user's categories, from a "#tag". */
  category?: string | null;
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

  const segments = splitCapture(text);

  if (segments.length > 1) {
    // Recursively route each segment
    const routedSegments = await Promise.all(
      segments.map((segment) => routeCapture(segment, userSettings)),
    );
    return routedSegments.flat();
  }

  // 1. Location
  const putAway = text.trim().match(PUT_AWAY);
  if (putAway) {
    const [, rawItem, prep, rawPlace] = putAway;
    const inOnAt = /^(?:in|on|at)$/i.test(prep);
    results.push(
      routedItem({
        type: "location",
        title: inOnAt ? rawPlace.replace(ARTICLE, "") : `${prep} ${rawPlace}`,
        destination: "Remember → Locations",
        destinationId: "locations",
        item_name: /^(?:it|them)$/i.test(rawItem)
          ? "Item"
          : capitalise(rawItem),
        confidence: 0.86,
        reason: "location_put_away",
      }),
    );
    return results;
  }

  // Task details, read once: a date means "the dentist is at 3pm" is an
  // appointment, not where something is kept.
  const parsed = await parseTaskText(text, {
    parseDates: userSettings?.nlp_date_parsing !== false,
    categories: userSettings?.do_categories ?? DEFAULT_DO_CATEGORIES,
  });

  const matchedLocKw = lower.match(LOCATION_RE)?.[0];
  // Splitting with a case-insensitive regex keeps the original case. The
  // keyword comes from LOCATION_KW, escaped all the same.
  const splitRegex = matchedLocKw
    ? new RegExp(`\\b${escapeRegExp(matchedLocKw)}\\b`, "i")
    : null;
  const locationItem = splitRegex ? text.split(splitRegex)[0].trim() : "";
  if (
    matchedLocKw &&
    !parsed.deadline &&
    !parsed.recurrence &&
    !NOT_AN_ITEM.test(locationItem.replace(ARTICLE, ""))
  ) {
    let itemName = "Item";
    let locationText = text;

    const parts = text.split(splitRegex!);

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

  // 2. A thought label up front ("idea: call it Presense").
  if (THOUGHT_LEAD.test(lower)) {
    results.push(
      routedItem({
        type: "thought",
        title: text,
        destination: "Think",
        destinationId: "think",
        confidence: 0.84,
        reason: "thought_label",
      }),
    );
    return results;
  }

  // 3. Task: repeats, dates, priority, estimate, category and a cleaned
  // title from the shared parser (also used by the task panel, so both read
  // text the same way).
  const startsWithVerb = TASK_VERB_RE.test(stripLeadIn(parsed.title));
  const hasDetail =
    parsed.deadline ||
    parsed.recurrence ||
    parsed.priority !== null ||
    parsed.category !== null ||
    parsed.estimateMinutes !== null;

  // A question ("Can I pay by card?") is only a task when it carries a
  // date, repeat or other detail.
  const soundsLikeTask =
    !QUESTION.test(lower) && (TASK_RE.test(lower) || startsWithVerb);
  if (soundsLikeTask || hasDetail) {
    results.push(
      routedItem({
        type: "task",
        title: parsed.title || text,
        destination: "Do",
        destinationId: "do",
        deadline: parsed.deadline ? parsed.deadline.toISOString() : null,
        recurrence: parsed.recurrence,
        priority: parsed.priority,
        estimateMinutes: parsed.estimateMinutes,
        category: parsed.category,
        confidence: parsed.deadline || parsed.recurrence ? 0.9 : 0.82,
        reason: parsed.deadline
          ? "task_keyword_with_date"
          : parsed.recurrence
            ? "task_recurrence_rule"
            : startsWithVerb
              ? "task_verb"
              : "task_keyword",
      }),
    );
    return results;
  }

  // 4. Thought → Think
  if (THOUGHT_RE.test(lower)) {
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

  // 5. Unknown — routes to Inbox
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
