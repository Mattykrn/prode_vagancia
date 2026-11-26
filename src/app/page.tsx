// ============================================================================
// SECCIÓN 1: IMPORTACIONES DEL SERVER COMPONENT RAÍZ (src/app/page.tsx)
// ============================================================================

import { LoginScreen } from '@/components/LoginScreen';
import { redirect } from 'next/navigation';
import { ProdeArena } from '@/components/ProdeArena';
import { BottomNav } from '@/components/layout/BottomNav';
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
  entries: LeaderboardEntry[];
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
    return (
      <div className="min-h-screen bg-zinc-950">
        <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-center text-[11px] font-semibold text-emerald-300">
          Configurá tus credenciales de Supabase en .env.local o Vercel para usar la aplicación completa.
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
    return <LoginScreen demoMode={false} initialError={params.error} />;
  }

  const normalizedEmail = user?.email?.trim().toLowerCase() ?? '';

  if (!normalizedEmail) {
    return <LoginScreen demoMode={false} initialError={params.error} />;
  }

  const { data: allowed } = await supabase
    .from('allowed_users')
    .select('email, nickname, is_admin')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (!allowed) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="rounded-2xl bg-black/80 p-8 chalk-border max-w-md">
            <div className="text-center mb-6">
              <span className="text-amber-400 text-5xl font-black mb-3">ℹ️</span>
              <h2 className="text-2xl font-black text-white mb-2">
                Acceso no autorizado
              </h2>
              <p className="text-zinc-400 text-sm">
                Tu correo electrónico ({normalizedEmail}) no figura en la lista de
                usuarios permitidos. Comunicá al administrador para que sea agregado.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  redirect('/login');
                }}
                className="w-full rounded-xl bg-red-600 py-2 text-sm font-black text-white hover:bg-red-700"
              >
                Cerrar sesión
              </button>
              <button
                onClick={() => redirect('/admin')}
                className="w-full rounded-xl bg-amber-600 py-2 text-sm font-black text-white hover:bg-amber-700"
              >
                Ir al panel de admin
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = Boolean(allowed?.is_admin);

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

  const list = (matchdays as { id: string; name: string; status: string; opens_at: string; closes_at: string }[]) ?? [];
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
  let adminAllPredictions: any[] | undefined;

  if (isAdmin && matchIds.length > 0) {
    const { data: allPreds } = await supabase
      .from('predictions')
      .select('match_id, user_id, pred_home, pred_away, points_earned, profile:profiles(full_name)')
      .in('match_id', matchIds);

    adminAllPredictions = ((allPreds as any[]) ?? []).map(
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

  const groupMap = new Map<string, MatchdayLeaderboardRow>();
  for (const row of (byMatchday as { [key: string]: any }[]) ?? []) {
    if (!groupMap.has(row.matchday_id)) {
groupMap.set(row.matchday_id, {
      matchday_id: row.matchday_id,
      matchday_name: row.matchday_name,
      id: row.id,
      email: row.email,
      display_name: row.display_name,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
      exact_hits: row.exact_hits,
      tendency_hits: row.tendency_hits,
      total_points: row.total_points,
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
        matchday={currentMatchday as import('@/lib/prode-engine').Matchday}
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