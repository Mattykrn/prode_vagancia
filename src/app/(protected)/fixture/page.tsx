// ============================================================================
// SECCIÓN 1: IMPORTACIONES DEL SERVER COMPONENT DEL CARTÓN DE LA FECHA
// ============================================================================

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import {
  buildDemoMatchdays,
  buildDemoMatches,
  DEMO_CURRENT_USER,
  DEMO_INITIAL_USER_PREDICTIONS,
  type MatchdayRecord,
} from '@/lib/demo-data';
import {
  FixtureScreen,
  type MatchItem,
  type UserPrediction,
} from '@/components/fixture/FixtureScreen';





// ============================================================================
// SECCIÓN 2: CARGA DE LA FECHA ACTUAL (OPEN / PRÓXIMA) Y LOS 10 PARTIDOS
// ============================================================================

export const dynamic = 'force-dynamic';

export default async function FixturePage() {
  if (!isSupabaseConfigured()) {
    const demoMatchdays = buildDemoMatchdays();
    const active = demoMatchdays.find((m) => m.status === 'OPEN') ?? demoMatchdays[0] ?? null;

    return (
      <FixtureScreen
        demoMode
        userId={DEMO_CURRENT_USER.id}
        matchday={active}
        initialMatches={buildDemoMatches()}
        initialPredictions={DEMO_INITIAL_USER_PREDICTIONS}
      />
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

  const list = (matchdays as MatchdayRecord[]) ?? [];
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
      matchday={currentMatchday}
      initialMatches={(matches as MatchItem[]) ?? []}
      initialPredictions={(predictions as UserPrediction[]) ?? []}
    />
  );
}
