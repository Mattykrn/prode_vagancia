// ============================================================================
// SECCIÓN 1: LAYOUT PROTEGIDO CON GUARD DE WHITELIST Y NAVEGACIÓN MÓVIL
// ============================================================================

import { redirect } from 'next/navigation';
import { BottomNav } from '@/components/layout/BottomNav';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createServerSupabaseClient } from '@/lib/supabase/server';





// ============================================================================
// SECCIÓN 2: RENDER CON BANNER DE MODO DEMO CUANDO NO HAY CREDENCIALES
// ============================================================================

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const demoMode = !isSupabaseConfigured();
  let isAdmin = true;

  if (!demoMode) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      redirect('/login');
    }

    const { data: allowed } = await supabase
      .from('allowed_users')
      .select('is_admin')
      .eq('email', user.email.trim().toLowerCase())
      .maybeSingle();

    if (!allowed) {
      redirect('/login?error=not_allowed');
    }

    isAdmin = Boolean(allowed.is_admin);
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {demoMode && (
        <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-center text-[11px] font-semibold text-emerald-300">
          Modo Demo Local activo · Configurá .env.local para conectar tu proyecto Supabase
        </div>
      )}
      {children}
      <BottomNav isAdmin={isAdmin} demoMode={demoMode} />
    </div>
  );
}

