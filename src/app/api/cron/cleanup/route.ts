import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    const results = await Promise.all([
      // Items (Tasks)
      supabase.from('items').delete().eq('status', 'deleted').lte('updated_at', cutoffDate),
      
      // Threads
      supabase.from('threads').delete().eq('status', 'deleted').lte('updated_at', cutoffDate),
      
      // Explores
      supabase.from('explores').delete().eq('status', 'deleted').lte('revisited_at', cutoffDate)
    ]);

    return NextResponse.json({ success: true, message: "Hard delete cleanup executed." });
  } catch (error: any) {
    console.error('Cleanup cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
