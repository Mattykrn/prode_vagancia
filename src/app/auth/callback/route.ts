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
  const errorDescription = searchParams.get('error_description');

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/?error=supabase_not_configured`);
  }

  if (!code) {
    const err = errorDescription || 'No se recibió código de autorización';
    return NextResponse.redirect(`${origin}/?error=auth_failed&details=${encodeURIComponent(err)}`);
  }

  const supabase = await createServerSupabaseClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    const errMsg = errorDescription || exchangeError.message || 'Error al intercambiar código';
    return NextResponse.redirect(`${origin}/?error=auth_failed&details=${encodeURIComponent(errMsg)}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const normalizedEmail = user?.email?.trim().toLowerCase() ?? '';

  const { data: allowed } = await supabase
    .from('allowed_users')
    .select('email, is_admin')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (!allowed) {
    await supabase.auth.signOut();
    const errMsg = errorDescription || 'Usuario no está en la lista blanca';
    return NextResponse.redirect(`${origin}/?error=not_allowed&details=${encodeURIComponent(errMsg)}`);
  }

  return NextResponse.redirect(`${origin}/`);
}
