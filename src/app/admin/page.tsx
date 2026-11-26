// ============================================================================
// SECCIÓN 1: SERVER COMPONENT PROTEGIDO DEL VESTUARIO DT (src/app/admin/page.tsx)
// ============================================================================

import { redirect } from 'next/navigation';
import AdminDashboard from '@/components/admin/AdminDashboard';
import { BottomNav } from '@/components/layout/BottomNav';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { LoginScreen } from '@/components/LoginScreen';
import type { Matchday, MatchItem } from '@/lib/prode-engine';

// ============================================================================
// SECCIÓN 2: GUARD DE SERVIDOR (SI NO ESTÁ LOGUEADO O is_admin !== true -> /)
// ============================================================================

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-center text-[11px] font-semibold text-emerald-300">
          Configurá tus credenciales de Supabase en .env.local o Vercel para acceder al panel de administración.
        </div>
        <LoginScreen demoMode={false} initialError={"Configure las credenciales de Supabase"} />
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect('/');
  }

  const { data: allowed } = await supabase
    .from('allowed_users')
    .select('is_admin')
    .eq('email', user.email.trim().toLowerCase())
    .maybeSingle();

  if (allowed?.is_admin !== true) {
    redirect('/');
  }

  const [{ data: matchdays }, { data: matches }] = await Promise.all([
    supabase
      .from('matchdays')
      .select('id, name, status, opens_at, closes_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('matches')
      .select(
        'id, matchday_id, order_index, competition_name, home_team, away_team, odd_home, odd_draw, odd_away, kickoff_time, status, home_score, away_score'
      )
      .order('order_index', { ascending: true }),
  ]);

  const list = (matchdays as Matchday[]) ?? [];

  return (
    <div className="min-h-screen bg-zinc-950">
      <AdminDashboard
        demoMode={false}
        matchdays={list}
        selectedMatchday={list[0] ?? null}
        matches={(matches as MatchItem[]) ?? []}
      />
      <BottomNav isAdmin demoMode={false} />
    </div>
  );
}