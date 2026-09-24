import { NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { checkRateLimit } from "@/lib/rate-limit";

/** Largest payload the schema can produce is well under this. */
const MAX_BODY_BYTES = 4096;
/**
 * Per IP. A page view reports about five Web Vitals, so this leaves room
 * for normal browsing while stopping anyone from flooding Sentry: the
 * route is public (see proxy.ts) because /login reports vitals too.
 */
const MAX_REPORTS_PER_MINUTE = 60;

function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

const telemetrySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("web-vital"),
    name: z.string().min(1).max(64),
    value: z.number().finite(),
    rating: z.enum(["good", "needs-improvement", "poor"]).optional(),
    path: z.string().max(256).optional(),
  }),
  z.object({
    kind: z.literal("client-error"),
    message: z.string().min(1).max(500),
    stack: z.string().max(2000).optional(),
    source: z.string().max(256).optional(),
    path: z.string().max(256).optional(),
  }),
]);

export async function POST(request: Request) {
  if (
    !(await checkRateLimit(
      "telemetry",
      clientIp(request),
      MAX_REPORTS_PER_MINUTE,
      60_000,
    ))
  ) {
    return new NextResponse(null, { status: 429 });
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = telemetrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid telemetry payload" },
      { status: 400 },
    );
  }

  if (parsed.data.kind === "client-error") {
    Sentry.captureMessage(parsed.data.message, {
      level: "error",
      extra: {
        telemetrySource: "client-error",
        stack: parsed.data.stack,
        source: parsed.data.source,
        path: parsed.data.path,
      },
    });
  } else {
    Sentry.captureMessage(parsed.data.name, {
      level: "info",
      extra: {
        telemetrySource: "web-vital",
        value: parsed.data.value,
        rating: parsed.data.rating,
        path: parsed.data.path,
      },
    });
  }

  console.warn("[telemetry]", parsed.data);
  return new NextResponse(null, { status: 204 });
}
