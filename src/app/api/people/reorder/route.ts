import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { reorderSchema } from "@/lib/schemas";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database.types";
import * as Sentry from "@sentry/nextjs";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await checkRateLimit("people-reorder", user.id, 30, 60_000))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = reorderSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const { items } = parsed.data;

    const { error } = await supabase.from("people").upsert(
      items.map(
        ({ id, sort_order }) =>
          ({
            id,
            user_id: user.id,
            sort_order,
          }) as Database["public"]["Tables"]["people"]["Insert"],
      ),
      { onConflict: "id" },
    );
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    Sentry.captureException(error);
    logger.error("[people/reorder] Error:", error);
    return NextResponse.json(
      { error: "Failed to reorder people" },
      { status: 500 },
    );
  }
}
