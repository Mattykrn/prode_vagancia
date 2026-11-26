// ============================================================================
// SECCIÓN 1: SERVER COMPONENT PROTEGIDO DEL VESTUARIO DT (src/app/admin/page.tsx)
// ============================================================================

import { redirect } from 'next/navigation';
import AdminDashboard from '@/components/admin/AdminDashboard';
import { BottomNav } from '@/components/layout/BottomNav';
import { buildDemoMatchdays, buildDemoMatches } from '@/lib/demo-data';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Matchday, MatchItem } from '@/lib/prode-engine';





// ============================================================================
// SECCIÓN 2: GUARD DE SERVIDOR (SI NO ESTÁ LOGUEADO O is_admin !== true -> /)
// ============================================================================

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!isSupabaseConfigured()) {
    const demoMatchdays = buildDemoMatchdays();
    const demoMatches = buildDemoMatches();

    return (
      <div className="min-h-screen bg-zinc-950">
        <AdminDashboard
          demoMode
          matchdays={demoMatchdays}
          selectedMatchday={demoMatchdays[0] ?? null}
          matches={demoMatches}
        />
        <BottomNav isAdmin demoMode />
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

