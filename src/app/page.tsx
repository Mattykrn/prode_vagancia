// ============================================================================
// SECCIÓN 1: IMPORTACIONES DEL SERVER COMPONENT RAÍZ (src/app/page.tsx)
// ============================================================================

import { LoginScreen } from '@/components/LoginScreen';
import {
  ProdeArena,
  type AdminPredictionAuditRow,
} from '@/components/ProdeArena';
import { BottomNav } from '@/components/layout/BottomNav';
import {
  buildDemoMatchdays,
  buildDemoMatches,
  DEMO_CURRENT_USER,
  DEMO_INITIAL_USER_PREDICTIONS,
  DEMO_LEADERBOARD_BY_MATCHDAY,
  DEMO_LEADERBOARD_GENERAL,
  type MatchdayRecord,
} from '@/lib/demo-data';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { MatchItem, UserPrediction } from '@/components/fixture/FixtureScreen';
import type {
  LeaderboardEntry,
  MatchdayLeaderboardGroup,
} from '@/components/ranking/LeaderboardScreen';

interface MatchdayLeaderboardRow extends LeaderboardEntry {
  matchday_id: string;
  matchday_name: string;
}

interface RawAdminPredictionRow {
  match_id: string;
  user_id: string;
  pred_home: number;
  pred_away: number;
  points_earned: number;
  profile: { full_name: string } | { full_name: string }[] | null;
}





// ============================================================================
// SECCIÓN 2: PROTECCIÓN POR WHITELIST Y CARGA SEGURA DE ProdeArena
// ============================================================================

export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  if (!isSupabaseConfigured()) {
    const demoMatchdays = buildDemoMatchdays();
    const active =
      demoMatchdays.find((m) => m.status === 'OPEN') ?? demoMatchdays[0] ?? null;

    return (
      <div className="min-h-screen bg-zinc-950">
        <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-center text-[11px] font-semibold text-emerald-300">
          Modo Demo Local activo · Configurá NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel o .env.local
        </div>
        <ProdeArena
          demoMode
          userId={DEMO_CURRENT_USER.id}
          isAdmin
          matchday={active}
          matches={buildDemoMatches()}
          predictions={DEMO_INITIAL_USER_PREDICTIONS}
          generalLeaderboard={DEMO_LEADERBOARD_GENERAL}
          matchdayLeaderboards={DEMO_LEADERBOARD_BY_MATCHDAY}
          adminAllPredictions={[]}
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
    return <LoginScreen demoMode={false} initialError={params.error} />;
  }

  const normalizedEmail = user.email.trim().toLowerCase();
  const { data: allowed } = await supabase
    .from('allowed_users')
    .select('email, nickname, is_admin')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (!allowed) {
    return <LoginScreen demoMode={false} initialError="not_allowed" />;
  }

  const isAdmin = Boolean(allowed.is_admin);

  const [{ data: matchdays }, { data: general }, { data: byMatchday }] =
    await Promise.all([
      supabase
        .from('matchdays')
        .select('id, name, status, opens_at, closes_at')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('leaderboard')
        .select(
          'id, email, display_name, full_name, avatar_url, exact_hits, tendency_hits, total_points'
        ),
      supabase
        .from('leaderboard_by_matchday')
        .select(
          'matchday_id, matchday_name, id, email, display_name, full_name, avatar_url, exact_hits, tendency_hits, total_points'
        ),
    ]);

  const list = (matchdays as MatchdayRecord[]) ?? [];
  const currentMatchday =
    list.find((md) => md.status === 'OPEN') ??
    list.find((md) => md.status === 'CLOSED') ??
    list[0] ??
    null;

  const { data: matches } = currentMatchday
    ? await supabase
        .from('matches')
        .select(
          'id, matchday_id, order_index, competition_name, home_team, away_team, odd_home, odd_draw, odd_away, kickoff_time, status, home_score, away_score'
        )
        .eq('matchday_id', currentMatchday.id)
        .order('order_index', { ascending: true })
    : { data: [] };

  const matchIds = (matches ?? []).map((m) => m.id);
  const { data: predictions } =
    matchIds.length > 0
      ? await supabase
          .from('predictions')
          .select('match_id, pred_home, pred_away, points_earned')
          .eq('user_id', user.id)
          .in('match_id', matchIds)
      : { data: [] };

  // Seguridad: solo se consulta y pasa adminAllPredictions cuando is_admin === true
  let adminAllPredictions: AdminPredictionAuditRow[] | undefined;

  if (isAdmin && matchIds.length > 0) {
    const { data: allPreds } = await supabase
      .from('predictions')
      .select('match_id, user_id, pred_home, pred_away, points_earned, profile:profiles(full_name)')
      .in('match_id', matchIds);

    adminAllPredictions = ((allPreds as unknown as RawAdminPredictionRow[]) ?? []).map(
      (row) => {
        const profileObj = Array.isArray(row.profile) ? row.profile[0] : row.profile;
        return {
          match_id: row.match_id,
          user_id: row.user_id,
          pred_home: row.pred_home,
          pred_away: row.pred_away,
          points_earned: row.points_earned,
          player_name: profileObj?.full_name ?? 'Jugador',
        };
      }
    );
  } else if (isAdmin) {
    adminAllPredictions = [];
  }

  const groupMap = new Map<string, MatchdayLeaderboardGroup>();
  for (const row of (byMatchday as MatchdayLeaderboardRow[]) ?? []) {
    if (!groupMap.has(row.matchday_id)) {
      groupMap.set(row.matchday_id, {
        matchday_id: row.matchday_id,
        matchday_name: row.matchday_name,
        entries: [],
      });
    }
    groupMap.get(row.matchday_id)!.entries.push({
      id: row.id,
      email: row.email,
      display_name: row.display_name,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
      exact_hits: row.exact_hits,
      tendency_hits: row.tendency_hits,
      total_points: row.total_points,
    });
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <ProdeArena
        demoMode={false}
        userId={user.id}
        isAdmin={isAdmin}
        matchday={currentMatchday}
        matches={(matches as MatchItem[]) ?? []}
        predictions={(predictions as UserPrediction[]) ?? []}
        generalLeaderboard={(general as LeaderboardEntry[]) ?? []}
        matchdayLeaderboards={Array.from(groupMap.values())}
        adminAllPredictions={adminAllPredictions}
      />
      <BottomNav isAdmin={isAdmin} demoMode={false} />
    </div>
  );
}

