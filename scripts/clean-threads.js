const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // USE SERVICE ROLE
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanDupes() {
  const { data: threads, error } = await supabase.from('threads').select('id, title, status, is_pinned').eq('status', 'active');
  if (error) {
    console.error(error);
    return;
  }
  
  console.log("Total active threads:", threads.length);
  const titleMap = {};
  for (const t of threads) {
    if (!titleMap[t.title]) {
      titleMap[t.title] = [];
    }
    titleMap[t.title].push(t);
  }

  for (const [title, copies] of Object.entries(titleMap)) {
    if (title.startsWith('Daily Note') && copies.length > 1) {
      // keep the first one
      const [toKeep, ...toDelete] = copies;
      console.log(`Keeping ${toKeep.id}, deleting ${toDelete.length} copies of '${title}'`);
      for (const del of toDelete) {
        await supabase.from('threads').delete().eq('id', del.id);
      }
    }
  }
  console.log('Cleanup done.');
}

cleanDupes();
