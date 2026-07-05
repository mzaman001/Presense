import { registerCustomParsers } from '@/lib/chrono-custom';
import type { UserSettings } from '@/store/useAppStore';

// ─── Keyword arrays (from spec Section 12.3) ────────────────────────────────

const TASK_KW = [
  'remind', 'remember to', 'need to', 'have to', 'must', 'gotta',
  'buy', 'call', 'submit', 'finish', 'complete', 'due', 'deadline',
  'by friday', 'by tomorrow', 'by next', 'before', 'fix', 'send',
  'pay', 'book', 'schedule', 'prepare', 'check',
];

const PERSON_KW = [
  'said', 'told me', 'mentioned', 'wants to', 'asked me', 'asked if',
  'said that', 'told', 'suggest', 'recommended', 'promised', 'offered',
];

const LOCATION_KW = [
  'is in', 'is at', 'is on', 'are in', 'are at', 'are on', 'put it', 'put them', 'left it', 'left them',
  'placed', 'stored', 'kept', 'found it in', 'located in', 'sits in',
];

const THOUGHT_KW = [
  'i think', 'i wonder', 'what if', 'maybe i', 'maybe we', 'idea:',
  'goal:', 'planning to', 'i feel like', 'i believe', 'curious about',
  'been thinking', 'realised', 'realized',
];

const EXPLORE_KW = [
  'interesting', 'save this', 'read later', 'look into', 'concept:',
  'quote:', 'book:', 'article:', 'link:', 'check out', 'worth reading',
  'fascinating', 'cool article',
];

const URL_RE = /https?:\/\/[^\s]+/;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type RoutedItemType = 'task' | 'person_note' | 'location' | 'thought' | 'explore' | 'unknown';

export interface RoutedItem {
  type: RoutedItemType;
  title: string;
  destination: string;
  destinationId: "do" | "inbox" | "people" | "locations" | "think" | "explore";
  confidence: number;
  reason: string;
  person?: string;
  deadline?: string | null;
  url?: string;
  item_name?: string;
  recurrence?: string | null;
}

export function destinationToId(destination: string): RoutedItem["destinationId"] {
  if (destination === "Do") return "do";
  if (destination === "Inbox" || destination === "Choose space...") return "inbox";
  if (destination.includes("People")) return "people";
  if (destination.includes("Locations")) return "locations";
  if (destination === "Think") return "think";
  if (destination === "Explore") return "explore";
  return "inbox";
}

export function destinationIdToLabel(destinationId: RoutedItem["destinationId"]): string {
  const labels: Record<RoutedItem["destinationId"], string> = {
    do: "Do",
    inbox: "Inbox",
    people: "People",
    locations: "Locations",
    think: "Think",
    explore: "Explore",
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

export async function routeCapture(text: string, knownPeople: string[] = [], userSettings: Partial<UserSettings> = {}): Promise<RoutedItem[]> {
  const lower = text.toLowerCase().trim();
  // compromise doesn't export great TS types
  let doc: any = null;
  if (userSettings?.nlp_date_parsing !== false) {
    const nlp = (await import('compromise')).default;
    doc = nlp(text);
  }
  const results: RoutedItem[] = [];

  // If smart routing is disabled, just return as Unknown (Inbox)
  if (userSettings?.smart_routing_enabled === false) {
    results.push(routedItem({ type: 'unknown', title: text, destination: 'Inbox', destinationId: "inbox", confidence: 1, reason: "smart_routing_disabled" }));
    return results;
  }

  // Split on "also", "and also", ". " for multi-item captures
  const segments = text
    .split(/\.\s+(?=[A-Z])|,?\s+(?:and also|also)\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length > 1) {
    // Recursively route each segment
    const routedSegments = await Promise.all(segments.map((segment) => routeCapture(segment, knownPeople, userSettings)));
    return routedSegments.flat();
  }

  // 1. URL → Explore
  const urlMatch = text.match(URL_RE);
  if (urlMatch) {
    results.push(routedItem({
      type: 'explore',
      title: text.replace(URL_RE, '').trim() || 'Saved link',
      destination: 'Explore',
      destinationId: "explore",
      url: urlMatch[0],
      confidence: 0.98,
      reason: "url_detected_explore",
    }));
    return results;
  }

  // 2. Person note — name detection via compromise + knownPeople
  const detectedNames = doc ? doc.people().json().map((p: { text: string }) => p.text) : [];
  const matchedKnown = knownPeople.find((p) => lower.includes(p.toLowerCase()));
  let matchedName = matchedKnown || (detectedNames.length > 0 ? detectedNames[0] : null);
  if (matchedName) {
    matchedName = matchedName.replace(/['’]s$/i, '');
  }

  if (matchedName && PERSON_KW.some((k) => lower.includes(k))) {
    results.push(routedItem({
      type: 'person_note',
      title: text,
      destination: 'Remember → People',
      destinationId: "people",
      person: matchedName,
      confidence: 0.88,
      reason: "known_person_and_person_keyword",
    }));
    return results;
  }

  // 3. Location
  const matchedLocKw = LOCATION_KW.find((k) => lower.includes(k));
  if (matchedLocKw) {
    let itemName = "Item";
    let locationText = text;
    
    // Preserve original case by splitting with a case-insensitive regex
    const splitRegex = new RegExp(`\\b${matchedLocKw}\\b`, 'i');
    const parts = text.split(splitRegex);
    
    if (parts.length > 1 && parts[0].trim().length > 0) {
      let rawItem = parts[0].trim();
      rawItem = rawItem.replace(/^(my|the|our|his|her|their|a|an|your)\s+/i, '');
      if (rawItem.length > 0) {
        itemName = rawItem.charAt(0).toUpperCase() + rawItem.slice(1);
      }
      
      let rawLoc = parts[1].trim();
      rawLoc = rawLoc.replace(/^(my|the|our|his|her|their|a|an|your)\s+/i, '');
      if (rawLoc.length > 0) {
        locationText = rawLoc;
      }
    }
    
    results.push(routedItem({
      type: 'location',
      title: locationText,
      destination: 'Remember → Locations',
      destinationId: "locations",
      item_name: itemName,
      confidence: 0.86,
      reason: "location_keyword",
    }));
    return results;
  }

  // 4a. Recurrence detection
  let detectedRRule: string | null = null;
  let recurrencePhraseToRemove = '';
  const dayMap: Record<string, string> = {
    monday: 'MO', mon: 'MO', tuesday: 'TU', tue: 'TU', wednesday: 'WE', wed: 'WE',
    thursday: 'TH', thu: 'TH', friday: 'FR', fri: 'FR', saturday: 'SA', sat: 'SA', sunday: 'SU', sun: 'SU'
  };

  if (lower.includes('every weekday')) {
    detectedRRule = 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
    recurrencePhraseToRemove = 'every weekday';
  } else if (lower.includes('every other day')) {
    detectedRRule = 'FREQ=DAILY;INTERVAL=2';
    recurrencePhraseToRemove = 'every other day';
  } else {
    const intervalMatch = lower.match(/every\s+(\d+)\s+(day|week|month|year)s?/);
    if (intervalMatch) {
      const interval = intervalMatch[1];
      const freq = intervalMatch[2].toUpperCase() + 'LY';
      detectedRRule = `FREQ=${freq};INTERVAL=${interval}`;
      recurrencePhraseToRemove = intervalMatch[0];
    } else {
      const dayNamesStr = Object.keys(dayMap).join('|');
      const daysRegex = new RegExp(`every\\s+((?:(?:${dayNamesStr})(?:\\s*,\\s*|\\s+and\\s+|\\s+)?)+)`, 'i');
      const everyDaysMatch = lower.match(daysRegex);
      if (everyDaysMatch) {
        const daysStr = everyDaysMatch[1];
        const matchedDays = Object.keys(dayMap).filter(d => new RegExp(`\\b${d}\\b`).test(daysStr));
        if (matchedDays.length > 0) {
          const byDay = [...new Set(matchedDays.map(d => dayMap[d]))].join(',');
          detectedRRule = `FREQ=WEEKLY;BYDAY=${byDay}`;
          recurrencePhraseToRemove = everyDaysMatch[0].trim();
        }
      }
    }
  }

  if (!detectedRRule) {
    const recurrencePatterns: Record<string, string> = {
      'every day': 'FREQ=DAILY',
      'daily': 'FREQ=DAILY',
      'every week': 'FREQ=WEEKLY',
      'weekly': 'FREQ=WEEKLY',
      'every month': 'FREQ=MONTHLY',
      'monthly': 'FREQ=MONTHLY',
    };
    for (const [pattern, rrule] of Object.entries(recurrencePatterns)) {
      if (lower.includes(pattern)) {
        detectedRRule = rrule;
        recurrencePhraseToRemove = pattern;
        break;
      }
    }
  }

  // 4. Task — extract natural language date
  let parsedDate: Date | null = null;
  let parsedText = '';
  if (userSettings?.nlp_date_parsing !== false) {
    const chrono = await import('chrono-node');
    registerCustomParsers(chrono);
    const parsedResults = chrono.parse(text);
    if (parsedResults.length > 0) {
      parsedDate = parsedResults[0].start.date();
      parsedText = parsedResults[0].text;
    }
  }

  if (TASK_KW.some((k) => lower.includes(k)) || parsedDate || detectedRRule) {
    let deadline: string | null = null;
    let cleanTitle = text;
    
    if (recurrencePhraseToRemove) {
      cleanTitle = cleanTitle.replace(new RegExp(escapeRegex(recurrencePhraseToRemove), 'i'), '').replace(/\s+/g, ' ').trim();
    }
    
    if (parsedDate) {
      deadline = parsedDate.toISOString();
      if (parsedText && cleanTitle.toLowerCase().includes(parsedText.toLowerCase())) {
        cleanTitle = cleanTitle.replace(new RegExp(escapeRegex(parsedText), 'i'), '').replace(/\s+/g, ' ').trim();
      }
    }
    
    // Also strip common prefix patterns like "remind me to", "remember to"
    cleanTitle = cleanTitle.replace(/^(remind me to|remember to|need to|have to|must|gotta)\s+/i, '');
    // Capitalize first letter
    if (cleanTitle.length > 0) cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
    
    results.push(routedItem({
      type: 'task',
      title: cleanTitle || text,
      destination: 'Do',
      destinationId: "do",
      deadline,
      recurrence: detectedRRule,
      confidence: parsedDate || detectedRRule ? 0.9 : 0.82,
      reason: parsedDate ? "task_keyword_with_date" : detectedRRule ? "task_recurrence_rule" : "task_keyword",
    }));
    return results;
  }

  // 5. Thought → Think
  if (THOUGHT_KW.some((k) => lower.includes(k))) {
    results.push(routedItem({ type: 'thought', title: text, destination: 'Think', destinationId: "think", confidence: 0.78, reason: "thought_keyword" }));
    return results;
  }

  // 6. Explore keywords
  if (EXPLORE_KW.some((k) => lower.includes(k))) {
    results.push(routedItem({ type: 'explore', title: text, destination: 'Explore', destinationId: "explore", confidence: 0.78, reason: "explore_keyword" }));
    return results;
  }

  // 7. Unknown — routes to Inbox
  results.push(routedItem({ type: 'unknown', title: text, destination: 'Inbox', destinationId: "inbox", confidence: 0.45, reason: "fallback_inbox" }));
  return results;
}
