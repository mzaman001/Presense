const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://mhfzmgrrtruxuiscvbhm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZnptZ3JydHJ1eHVpc2N2YmhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTQwODMyOSwiZXhwIjoyMDk2OTg0MzI5fQ.MKKc41ntIcNRDSfwUaQRlJc7Qm2K8nrwX1yUi-RTBy8'
);

async function check() {
  const { data, error } = await supabase.from('items').select('id, title, snoozed_until').eq('title', 'Testing the list view');
  console.log("Error:", error);
  console.log("Data:", data);
}
check();
