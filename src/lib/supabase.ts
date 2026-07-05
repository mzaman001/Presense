import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/env';
import { Database } from '@/types/database.types';

let clientInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (typeof window === 'undefined') {
    return createBrowserClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }

  if (!clientInstance) {
    clientInstance = createBrowserClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return clientInstance;
}

