import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRRule(rrule: string | null | undefined): string {
  if (!rrule) return "";
  const intervalMatch = rrule.match(/INTERVAL=(\d+)/);
  const interval = intervalMatch ? parseInt(intervalMatch[1]) : 1;
  
  if (rrule.includes("FREQ=DAILY")) return interval === 2 ? "Every other day" : interval > 1 ? `Every ${interval} days` : "Every day";
  if (rrule.includes("FREQ=MONTHLY")) return interval > 1 ? `Every ${interval} months` : "Every month";
  if (rrule.includes("FREQ=WEEKLY")) {
    const match = rrule.match(/BYDAY=([A-Z,]+)/);
    if (match) {
      const days = match[1].split(',').map(d => {
        /* @todo: Untyped usage justified per TOOL-01 */
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const map: any = { MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun" };
        return map[d] || d;
      });
      if (days.length === 5 && match[1] === "MO,TU,WE,TH,FR") return "Every weekday";
      if (days.length === 2) return `Every ${days.join(' & ')}`;
      if (days.length > 2) {
        const last = days.pop();
        return `Every ${days.join(', ')} & ${last}`;
      }
      return `Every ${days[0]}`;
    }
    return interval > 1 ? `Every ${interval} weeks` : "Every week";
  }
  return "Recurring";
}

export function extractMentions(text: string): string[] {
  const regex = /@\[[^\]]+\]\(([^)]+)\)/g;
  const uuidRegex = /^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const id = match[1];
    if (uuidRegex.test(id)) {
      matches.push(id);
    }
  }
  return matches;
}
