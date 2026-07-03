import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { accountDeleteSchema } from '@/lib/schemas';

export async function DELETE(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await checkRateLimit(user.id, 3, 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const parsed = accountDeleteSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    if (parsed.data.confirmToken !== user.email) {
      return NextResponse.json({ error: 'Confirmation token does not match account email' }, { status: 400 });
    }

    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      logger.error('[account] SUPABASE_SERVICE_ROLE_KEY is not configured');
      return NextResponse.json(
        { error: 'Account deletion is not configured. Please contact support.' },
        { status: 500 }
      );
    }

    // Create a service-role client for admin operations
    const serviceClient = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Delete the auth user (requires service-role key)
    const { error } = await serviceClient.auth.admin.deleteUser(user.id);

    if (error) {
      logger.error('[account] deleteUser failed:', error);
      return NextResponse.json(
        { error: 'Failed to delete account. Please contact support.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[account] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete account. Please contact support.' },
      { status: 500 }
    );
  }
}
