import { NextResponse } from "next/server";
import { z } from "zod";

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
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = telemetrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid telemetry payload" }, { status: 400 });
  }

  console.warn("[telemetry]", parsed.data);
  return new NextResponse(null, { status: 204 });
}

