// ============================================================================
// SECCIÓN 1: IMPORTACIONES DEL SERVER COMPONENT DEL CARTÓN DE LA FECHA
// ============================================================================

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { FixtureScreen, type MatchItem, type UserPrediction } from '@/components/fixture/FixtureScreen';
import { LoginScreen } from '@/components/LoginScreen';

// ============================================================================
// SECCIÓN 2: CARGA DE LA FECHA ACTUAL (OPEN / PRÓXIMA) Y LOS 10 PARTIDOS
// ============================================================================

export const dynamic = 'force-dynamic';

export default async function FixturePage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-center text-[11px] font-semibold text-emerald-300">
          Configurá tus credenciales de Supabase en .env.local o Vercel para acceder al fixture.
        </div>
        <LoginScreen demoMode={false} initialError={"Configure las credenciales de Supabase"} />
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: matchdays } = await supabase
    .from('matchdays')
    .select('id, name, status, opens_at, closes_at')
    .order('created_at', { ascending: false })
    .limit(5);

  const list = (matchdays as { id: string; name: string; status: string; opens_at: string; closes_at: string }[]) ?? [];
  const currentMatchday =
    list.find((md) => md.status === 'OPEN') ??
    list.find((md) => md.status === 'CLOSED') ??
    list[0] ??
    null;

  if (!currentMatchday) {
    return (
      <FixtureScreen
        demoMode={false}
        userId={user.id}
        matchday={null}
        initialMatches={[]}
        initialPredictions={[]}
      />
    );
  }

  const { data: matches } = await supabase
    .from('matches')
    .select(
      'id, matchday_id, order_index, competition_name, home_team, away_team, odd_home, odd_draw, odd_away, kickoff_time, status, home_score, away_score'
    )
    .eq('matchday_id', currentMatchday.id)
    .order('order_index', { ascending: true });

  const matchIds = (matches ?? []).map((m) => m.id);
  const { data: predictions } =
    matchIds.length > 0
      ? await supabase
          .from('predictions')
          .select('match_id, pred_home, pred_away, points_earned')
          .eq('user_id', user.id)
          .in('match_id', matchIds)
      : { data: [] };

  return (
    <FixtureScreen
      demoMode={false}
      userId={user.id}
      matchday={currentMatchday as import('@/components/fixture/FixtureScreen').MatchdayRecord}
      initialMatches={(matches as MatchItem[]) ?? []}
      initialPredictions={(predictions as UserPrediction[]) ?? []}
    />
  );
}