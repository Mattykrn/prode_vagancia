// ============================================================================
// SECCIÓN 1: RESOLUCIÓN DE ORIGEN DINÁMICO EN PRODUCCIÓN (VERCEL / LOCAL)
// ============================================================================

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

function resolveOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https';

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return url.origin;
}





// ============================================================================
// SECCIÓN 2: INTERCAMBIO DE CÓDIGO OAUTH GOOGLE Y VALIDACIÓN DE WHITELIST
// ============================================================================

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = resolveOrigin(request);
  const code = searchParams.get('code');

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  const supabase = await createServerSupabaseClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const normalizedEmail = user?.email?.trim().toLowerCase() ?? '';

  const { data: allowed } = await supabase
    .from('allowed_users')
    .select('email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (!allowed) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/?error=not_allowed`);
  }

  return NextResponse.redirect(`${origin}/`);
}
