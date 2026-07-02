import { createClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { reorderSchema } from "@/lib/schemas";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!await checkRateLimit(user.id, 30, 60_000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = reorderSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { items } = parsed.data;

    await supabase.from("people").upsert(
      items.map(({ id, sort_order }) => ({ id, user_id: user.id, sort_order })),
      { onConflict: "id" }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[people/reorder] Error:", error);
    return NextResponse.json({ error: "Failed to reorder people" }, { status: 500 });
  }
}
