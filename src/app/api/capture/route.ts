import { createClient } from '@/lib/supabase-server';
import { routeCapture } from '@/lib/capture-router';
import { checkRateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!checkRateLimit(user.id, 100, 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { text, settings } = await request.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Fetch user's known people for name matching
    const { data: people } = await supabase
      .from('people')
      .select('name')
      .eq('user_id', user.id);

    const knownPeople = people?.map((p) => p.name) ?? [];

    // Run the rule-based NLP router
    const items = routeCapture(text, knownPeople, settings || {});

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Capture error:', error);
    return NextResponse.json({ error: 'Failed to process capture' }, { status: 500 });
  }
}
