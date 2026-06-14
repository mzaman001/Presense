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

    // Fetch users who have weekly_digest enabled
    const { data: users, error: userError } = await supabase
      .from('user_settings')
      .select('user_id, display_name')
      .eq('weekly_digest', true);

    if (userError) throw userError;

    // A real implementation would loop through `users`, query their completed items from the last 7 days, 
    // and send an email via Resend/SendGrid. For now, we simulate the Edge Function successfully running.
    
    console.log(`[Sunday Digest] Simulated sending to ${users?.length} users.`);

    return NextResponse.json({ success: true, sentTo: users?.length });
  } catch (error: any) {
    console.error('Digest cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
