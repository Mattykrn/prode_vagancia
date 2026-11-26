// ============================================================================
// SECCIÓN 1: TIPOS DEL DOMINIO (UNA SOLA FUENTE DE VERDAD PARA TODA LA APP)
// ============================================================================

import type { MatchdayStatus, MatchStatus } from './scoring';

export type { MatchdayStatus, MatchStatus };

export interface AllowedUser {
  email: string;
  nickname: string;
  is_admin: boolean;
}

export interface Matchday {
  id: string;
  name: string;
  status: MatchdayStatus;
  opens_at: string;
  closes_at: string | null;
}

export interface Match {
  id: string;
  matchday_id: string;
  order_index: number;
  competition_name: string;
  home_team: string;
  away_team: string;
  odd_home: number | null;
  odd_draw: number | null;
  odd_away: number | null;
  kickoff_time: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
}

export interface Prediction {
  match_id: string;
  pred_home: number;
  pred_away: number;
  points_earned: number;
}

export interface FriendPrediction extends Prediction {
  user_id: string;
  player_name: string;
}

export interface LeaderboardEntry {
  id: string;
  display_name: string;
  avatar_url: string | null;
  exact_hits: number;
  tendency_hits: number;
  total_points: number;
}

export interface MatchdayLeaderboard {
  matchday_id: string;
  matchday_name: string;
  entries: LeaderboardEntry[];
}

export const MATCH_COLUMNS =
  'id, matchday_id, order_index, competition_name, home_team, away_team, odd_home, odd_draw, odd_away, kickoff_time, status, home_score, away_score';

export const MATCHDAY_COLUMNS = 'id, name, status, opens_at, closes_at';

