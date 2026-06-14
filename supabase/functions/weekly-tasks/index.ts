import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    console.log("Running weekly tasks (Explore Digest & Stale Threads)");

    // 1. Process Explore Digest
    // Find explores not revisited and older than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // We would send a push notification here in a real app
    // For now, we update digest_at
    await supabase
      .from("explores")
      .update({ digest_at: new Date().toISOString() })
      .is("revisited_at", null)
      .lte("saved_at", sevenDaysAgo.toISOString());

    // 2. Process Stale Threads (Think Space)
    // Find threads not updated in 14 days and without a stale_prompt
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data: staleThreads } = await supabase
      .from("threads")
      .select("id, title")
      .is("stale_prompt", null)
      .lte("last_updated", fourteenDaysAgo.toISOString());

    if (staleThreads) {
      for (const thread of staleThreads) {
        // Generate a simple prompt
        const prompt = `It's been a while since you thought about "${thread.title}". Any new insights?`;
        await supabase
          .from("threads")
          .update({ stale_prompt: prompt })
          .eq("id", thread.id);
      }
    }

    return new Response(JSON.stringify({ success: true, message: "Weekly tasks completed" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Weekly tasks error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
