/* eslint-disable @typescript-eslint/no-explicit-any */
// compromise.js types are incomplete — using any for .people() and .dates()
import nlp from 'compromise';
import datePlugin from 'compromise-dates';
nlp.plugin(datePlugin as any);

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
  'is in', 'is at', 'is on', 'put it', 'put them', 'left it', 'left them',
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

// ─── Types ──────────────────────────────────────────────────────────────────

export type RoutedItemType = 'task' | 'person_note' | 'location' | 'thought' | 'explore' | 'unknown';

export interface RoutedItem {
  type: RoutedItemType;
  title: string;
  destination: string;
  person?: string;
  deadline?: string | null;
  url?: string;
  item_name?: string;
}

// ─── Main router ────────────────────────────────────────────────────────────

export function routeCapture(text: string, knownPeople: string[] = []): RoutedItem[] {
  const lower = text.toLowerCase().trim();
  const doc = nlp(text) as any;
  const results: RoutedItem[] = [];

  // Split on "also", "and also", ". " for multi-item captures
  const segments = text
    .split(/\.\s+(?=[A-Z])|,?\s+(?:and also|also)\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length > 1) {
    // Recursively route each segment
    return segments.flatMap((segment) => routeCapture(segment, knownPeople));
  }

  // 1. URL → Explore
  const urlMatch = text.match(URL_RE);
  if (urlMatch) {
    results.push({
      type: 'explore',
      title: text.replace(URL_RE, '').trim() || 'Saved link',
      destination: 'Explore',
      url: urlMatch[0],
    });
    return results;
  }

  // 2. Person note — name detection via compromise + knownPeople
  const detectedNames = doc.people().json().map((p: { text: string }) => p.text);
  const matchedKnown = knownPeople.find((p) => lower.includes(p.toLowerCase()));
  const matchedName = matchedKnown || (detectedNames.length > 0 ? detectedNames[0] : null);

  if (matchedName && PERSON_KW.some((k) => lower.includes(k))) {
    results.push({
      type: 'person_note',
      title: text,
      destination: 'People',
      person: matchedName,
    });
    return results;
  }

  // 3. Location
  const matchedLocKw = LOCATION_KW.find((k) => lower.includes(k));
  if (matchedLocKw) {
    // Split by the keyword to try and guess the item name
    let itemName = "Item";
    const parts = lower.split(matchedLocKw);
    if (parts.length > 1 && parts[0].trim().length > 0) {
      // E.g. "my keys are in..." -> "my keys" -> drop "my", "the" if possible
      itemName = parts[0].trim().replace(/^(my|the|our|your)\s+/i, "");
    }
    
    results.push({
      type: 'location',
      title: text,
      destination: 'Locations',
      item_name: itemName.charAt(0).toUpperCase() + itemName.slice(1),
    });
    return results;
  }

  // 4. Task — extract natural language date
  if (TASK_KW.some((k) => lower.includes(k))) {
    const dates = doc.dates().json();
    const deadline = dates.length > 0 ? dates[0].start ?? null : null;
    results.push({
      type: 'task',
      title: text,
      destination: 'Do',
      deadline,
    });
    return results;
  }

  // 5. Thought → Think
  if (THOUGHT_KW.some((k) => lower.includes(k))) {
    results.push({ type: 'thought', title: text, destination: 'Think' });
    return results;
  }

  // 6. Explore keywords
  if (EXPLORE_KW.some((k) => lower.includes(k))) {
    results.push({ type: 'explore', title: text, destination: 'Explore' });
    return results;
  }

  // 7. Unknown — routes to Inbox
  results.push({ type: 'unknown', title: text, destination: 'Inbox' });
  return results;
}
