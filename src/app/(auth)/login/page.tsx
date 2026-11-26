// ============================================================================
// SECCIÓN 1: PÁGINA DE LOGIN (USA LoginScreen COMPARTIDO)
// ============================================================================

import { LoginScreen } from '@/components/LoginScreen';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return <LoginScreen demoMode={!isSupabaseConfigured()} initialError={params.error} />;
}
