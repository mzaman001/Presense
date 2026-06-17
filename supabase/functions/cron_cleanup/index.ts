import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    const results = await Promise.all([
      // Items (Tasks)
      supabase.from('items').delete().eq('status', 'deleted').not('deleted_at', 'is', null).lte('deleted_at', cutoffDate),
      
      // Threads
      supabase.from('threads').delete().eq('status', 'deleted').not('deleted_at', 'is', null).lte('deleted_at', cutoffDate),
      
      // Explores
      supabase.from('explores').delete().eq('status', 'deleted').not('deleted_at', 'is', null).lte('deleted_at', cutoffDate)
    ]);

    // Check for errors in the results array
    for (const res of results) {
      if (res.error) throw res.error;
    }

    return new Response(
      JSON.stringify({ message: "Hard delete cleanup executed successfully." }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { headers: { "Content-Type": "application/json" }, status: 500 },
    )
  }
})
