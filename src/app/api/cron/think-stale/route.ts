import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const STALE_PROMPTS = [
  "Have you thought more about this?",
  "Did this idea go anywhere?",
  "Any new developments here?",
  "Is this still on your mind?",
  "Time to revisit this thread?",
];

export async function GET(request: Request) {
  try {
    // Verify cron secret if needed (optional security measure)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Use service role key to bypass RLS for cron job
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get threads older than 7 days without a stale prompt
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: threads, error: fetchError } = await supabase
      .from('threads')
      .select('id')
      .lt('last_updated', sevenDaysAgo.toISOString())
      .is('stale_prompt', null);

    if (fetchError) throw fetchError;

    if (!threads || threads.length === 0) {
      return NextResponse.json({ success: true, message: "No stale threads found" });
    }

    // Update threads with random prompts
    const updatePromises = threads.map((thread) => {
      const prompt = STALE_PROMPTS[Math.floor(Math.random() * STALE_PROMPTS.length)];
      return supabase.from('threads').update({ stale_prompt: prompt }).eq('id', thread.id);
    });

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true, message: `Updated ${threads.length} threads` });
  } catch (error: any) {
    console.error('Think stale cron error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
