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
  let matchedName = matchedKnown || (detectedNames.length > 0 ? detectedNames[0] : null);
  if (matchedName) {
    matchedName = matchedName.replace(/['’]s$/i, '');
  }

  if (matchedName && PERSON_KW.some((k) => lower.includes(k))) {
    results.push({
      type: 'person_note',
      title: text,
      destination: 'Remember → People',
      person: matchedName,
    });
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
    
    results.push({
      type: 'location',
      title: locationText,
      destination: 'Remember → Locations',
      item_name: itemName,
    });
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
      const daysRegex = new RegExp(`every\\s+((?:(?:\\b(?:${dayNamesStr})\\b)(?:\\s*,\\s*|\\s+and\\s+|\\s+)?)+)`, 'i');
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
  if (TASK_KW.some((k) => lower.includes(k)) || doc.dates().found || detectedRRule) {
    const dates = doc.dates().json();
    let deadline: string | null = null;
    let cleanTitle = text;
    
    if (recurrencePhraseToRemove) {
      cleanTitle = cleanTitle.replace(new RegExp(recurrencePhraseToRemove, 'i'), '').replace(/\s+/g, ' ').trim();
      cleanTitle = cleanTitle.replace(/^(and\s+|,?\s*and\s+)/i, '').trim();
    }
    
    if (dates.length > 0) {
      deadline = dates[0].dates?.start ?? null;
      // Remove the date phrase from the title
      const dateText = dates[0].text ?? '';
      if (dateText && cleanTitle.toLowerCase().includes(dateText.toLowerCase())) {
        cleanTitle = cleanTitle.replace(new RegExp(dateText, 'i'), '').replace(/\s+/g, ' ').trim();
      }
    }
    
    // Also strip common prefix patterns like "remind me to", "remember to"
    cleanTitle = cleanTitle.replace(/^(remind me to|remember to|need to|have to|must|gotta)\s+/i, '');
    // Capitalize first letter
    if (cleanTitle.length > 0) cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
    
    results.push({
      type: 'task',
      title: cleanTitle || text,
      destination: 'Do',
      deadline,
      recurrence: detectedRRule,
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
