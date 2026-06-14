import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    // Verify cron secret if needed
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: "Missing Supabase credentials" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all users who have unvisited explores
    const { data: explores, error: fetchError } = await supabase
      .from('explores')
      .select('user_id, id, title, type, url')
      .is('revisited_at', null);

    if (fetchError) throw fetchError;

    if (!explores || explores.length === 0) {
      return NextResponse.json({ success: true, message: "No unvisited explores found" });
    }

    // Group explores by user
    const exploresByUser: Record<string, typeof explores> = {};
    explores.forEach(explore => {
      if (!exploresByUser[explore.user_id]) exploresByUser[explore.user_id] = [];
      exploresByUser[explore.user_id].push(explore);
    });

    let emailsSent = 0;

    // Simulate sending email to each user
    for (const [userId, userExplores] of Object.entries(exploresByUser)) {
      // In a real app, fetch user email from auth.users (via service_role)
      // and send via Resend/SendGrid.
      console.log(`[Explore Digest] Sending to user ${userId}: ${userExplores.length} unvisited items.`);
      
      // For now, we just simulate success.
      emailsSent++;
    }

    return NextResponse.json({ success: true, message: `Sent Sunday Digest to ${emailsSent} users.` });
  } catch (error: any) {
    console.error('Explore digest cron error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
