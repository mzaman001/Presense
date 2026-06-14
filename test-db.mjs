import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env.local
const envFile = fs.readFileSync('.env.local', 'utf8');
const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const anonMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseAnonKey = anonMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || (envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || [])[1]?.trim();
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

async function testDatabase() {
  console.log('--- Starting Database Verification ---');
  
  const testEmail = 'testuser' + Math.floor(Math.random() * 10000) + '@gmail.com';
  console.log(`Creating test user: ${testEmail}`);
  
  // Create user using admin client to bypass signup restrictions
  const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
    email: testEmail,
    password: 'password123',
    email_confirm: true,
    user_metadata: { full_name: 'Test User' }
  });

  if (adminError) {
    console.error('Admin Auth Error:', adminError.message);
    process.exit(1);
  }

  // Now sign in with anon client to test RLS
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: 'password123'
  });

  if (authError) {
    console.error('Auth Error:', authError.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`User created and logged in! UID: ${userId}`);

  // Wait a second for the trigger to insert into user_settings
  await new Promise(r => setTimeout(r, 1000));

  let allSuccess = true;

  async function testInsert(table, payload) {
    console.log(`Testing INSERT on ${table}...`);
    const { data, error } = await supabase.from(table).insert([{ user_id: userId, ...payload }]).select();
    if (error) {
      console.error(`❌ [${table}] INSERT FAILED:`, error.message, error.details);
      allSuccess = false;
    } else {
      console.log(`✅ [${table}] INSERT SUCCESS:`, data[0].id || 'Success');
    }
  }

  // 1. items
  await testInsert('items', {
    title: 'Test Task',
    first_step: 'Run the script',
    status: 'active'
  });

  // 2. people
  await testInsert('people', {
    name: 'Jane Doe',
    relationship: 'friend'
  });

  // 3. threads
  await testInsert('threads', {
    title: 'Testing Thoughts',
    entries: [{ text: 'This is a test entry', created_at: new Date().toISOString() }]
  });

  // 4. explores
  await testInsert('explores', {
    title: 'Test Link',
    type: 'link',
    url: 'https://example.com',
    note: 'Test note'
  });

  // 5. locations
  await testInsert('locations', {
    item_name: 'Keys',
    location_text: 'On the desk'
  });

  // 6. push_subscriptions
  await testInsert('push_subscriptions', {
    endpoint: 'https://push.example.com',
    p256dh: 'test_p256dh',
    auth_key: 'test_auth'
  });

  // 7. Verify user_settings was auto-created
  console.log(`Testing SELECT on user_settings...`);
  const { data: usData, error: usError } = await supabase.from('user_settings').select('*').eq('user_id', userId);
  if (usError) {
    console.error(`❌ [user_settings] SELECT FAILED:`, usError.message);
    allSuccess = false;
  } else if (usData.length === 0) {
    console.error(`❌ [user_settings] NOT FOUND! Trigger may have failed.`);
    allSuccess = false;
  } else {
    console.log(`✅ [user_settings] FOUND! Trigger works.`);
  }

  if (allSuccess) {
    console.log('\n✅ ALL DATABASE TESTS PASSED. The DB layer and RLS are solid.');
  } else {
    console.log('\n❌ DATABASE TESTS FAILED. See errors above.');
  }

  process.exit(allSuccess ? 0 : 1);
}

testDatabase();
