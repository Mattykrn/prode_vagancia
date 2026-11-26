// ============================================================================
// SECCIÓN 1: SESIÓN DEL USUARIO + VALIDACIÓN CONTRA LA WHITELIST (allowed_users)
// ============================================================================

import { createServerSupabaseClient } from './server';
import type { AllowedUser } from '@/lib/types';

export async function getSessionContext() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { supabase, user: null, member: null };
  }

  const { data } = await supabase
    .from('allowed_users')
    .select('email, nickname, is_admin')
    .eq('email', user.email.trim().toLowerCase())
    .maybeSingle();

  return { supabase, user, member: (data as AllowedUser | null) ?? null };
}

