// ============================================================================
// SECCIÓN 1: IMPORTACIONES DEL SERVER COMPONENT DE RANKING GENERAL Y POR FECHA
// ============================================================================

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import {
  LeaderboardScreen,
  type LeaderboardEntry,
  type MatchdayLeaderboardGroup,
} from '@/components/ranking/LeaderboardScreen';
import { LoginScreen } from '@/components/LoginScreen';

// ============================================================================
// SECCIÓN 2: CONSULTA DE VISTAS LEADERBOARD Y RENDER DEL RANKING
// ============================================================================

export const dynamic = 'force-dynamic';

export default async function RankingPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <div className="border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-center text-[11px] font-semibold text-emerald-300">
          Configurá tus credenciales de Supabase en .env.local o Vercel para ver el ranking.
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

  const [{ data: general }, { data: byMatchday }] = await Promise.all([
    supabase
      .from('leaderboard')
      .select('id, email, display_name, full_name, avatar_url, exact_hits, tendency_hits, total_points'),
    supabase
      .from('leaderboard_by_matchday')
      .select(
        'matchday_id, matchday_name, id, email, display_name, full_name, avatar_url, exact_hits, tendency_hits, total_points'
      ),
  ]);

  const groupMap = new Map<string, MatchdayLeaderboardGroup>();
  for (const row of (byMatchday as unknown as { [key: string]: any }[]) ?? []) {
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
    <LeaderboardScreen
      currentUserId={user.id}
      generalEntries={(general as LeaderboardEntry[]) ?? []}
      matchdayGroups={Array.from(groupMap.values())}
    />
  );
}