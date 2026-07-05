import { logger } from "@/lib/logger";
import { createClient } from '@/lib/supabase-server';
import { routeCapture } from '@/lib/capture-router';
import { checkRateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';
import { captureSchema } from '@/lib/schemas';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await checkRateLimit(user.id, 100, 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const parsed = captureSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { text, settings } = parsed.data;

    // Fetch user's known people for name matching
    const { data: people } = await supabase
      .from('people')
      .select('name')
      .eq('user_id', user.id);

    const knownPeople = people?.map((p) => p.name) ?? [];

    // Run the rule-based NLP router
    const items = await routeCapture(text, knownPeople, settings || {});

    return NextResponse.json({ items });
  } catch (error) {
    logger.error('Capture error:', error);
    return NextResponse.json({ error: 'Failed to process capture' }, { status: 500 });
  }
}
