// ============================================================================
// SECCIÓN 1: IMPORTACIONES DEL SERVER COMPONENT DE RANKING GENERAL Y POR FECHA
// ============================================================================

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import {
  DEMO_CURRENT_USER,
  DEMO_LEADERBOARD_BY_MATCHDAY,
  DEMO_LEADERBOARD_GENERAL,
} from '@/lib/demo-data';
import {
  LeaderboardScreen,
  type LeaderboardEntry,
  type MatchdayLeaderboardGroup,
} from '@/components/ranking/LeaderboardScreen';

interface MatchdayLeaderboardRow extends LeaderboardEntry {
  matchday_id: string;
  matchday_name: string;
}





// ============================================================================
// SECCIÓN 2: CONSULTA DE VISTAS LEADERBOARD Y RENDER DEL RANKING
// ============================================================================

export const dynamic = 'force-dynamic';

export default async function RankingPage() {
  if (!isSupabaseConfigured()) {
    return (
      <LeaderboardScreen
        currentUserId={DEMO_CURRENT_USER.id}
        generalEntries={DEMO_LEADERBOARD_GENERAL}
        matchdayGroups={DEMO_LEADERBOARD_BY_MATCHDAY}
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
    <LeaderboardScreen
      currentUserId={user.id}
      generalEntries={(general as LeaderboardEntry[]) ?? []}
      matchdayGroups={Array.from(groupMap.values())}
    />
  );
}
