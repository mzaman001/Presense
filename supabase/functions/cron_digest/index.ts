import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { data: users, error: userError } = await supabase
      .from('user_settings')
      .select('user_id, display_name')
      .eq('weekly_digest', true);

    if (userError) throw userError;

    // Simulate sending email via Resend/SendGrid
    console.log(`[Sunday Digest] Simulated sending to ${users?.length || 0} users.`);

    return new Response(
      JSON.stringify({ success: true, sentTo: users?.length || 0 }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { "Content-Type": "application/json" }, status: 500 },
    )
  }
})
