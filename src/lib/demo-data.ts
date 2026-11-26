// ============================================================================
// SECCIÓN 1: TIPOS Y ESTADO REINICIADO PARA COMENZAR LA FECHA 1 DESDE CERO
// ============================================================================

import type { MatchdayStatus, MatchStatus } from '@/lib/scoring';
import type { MatchItem, UserPrediction } from '@/components/fixture/FixtureScreen';
import type {
  LeaderboardEntry,
  MatchdayLeaderboardGroup,
} from '@/components/ranking/LeaderboardScreen';

export interface MatchdayRecord {
  id: string;
  name: string;
  status: MatchdayStatus;
  opens_at: string;
  closes_at: string | null;
}

export interface DemoFriendPrediction {
  match_id: string;
  user_id: string;
  pred_home: number;
  pred_away: number;
  points_earned: number;
  profile: {
    full_name: string;
    avatar_url: string | null;
  };
}

export interface DemoAllowedUser {
  email: string;
  nickname: string;
  is_admin: boolean;
}

export const DEMO_CURRENT_USER = {
  id: 'demo-user-1',
  email: 'admin@gmail.com',
  nickname: 'El Admin',
  full_name: 'Matías Admin',
  is_admin: true,
};





// ============================================================================
// SECCIÓN 2: FECHA 1 ACTIVA (INICIA HOY 25/11/2026 - TERMINA 02/12/2026)
// ============================================================================

export function buildDemoMatchdays(): MatchdayRecord[] {
  return [
    {
      id: 'fecha-1',
      name: 'Fecha 1 · 25/11 al 02/12',
      status: 'OPEN',
      opens_at: '2026-11-25T20:45:00-03:00',
      closes_at: '2026-12-02T23:59:00-03:00',
    },
  ];
}

export function buildDemoMatches(): MatchItem[] {
  return [
    {
      id: 'f1-m1',
      matchday_id: 'fecha-1',
      order_index: 1,
      competition_name: 'Europa League',
      home_team: 'Real Sociedad',
      away_team: 'Ajax',
      odd_home: 2.25,
      odd_draw: 3.3,
      odd_away: 3.15,
      kickoff_time: '2026-11-28T17:00:00-03:00',
      status: 'SCHEDULED',
      home_score: null,
      away_score: null,
    },
    {
      id: 'f1-m2',
      matchday_id: 'fecha-1',
      order_index: 2,
      competition_name: 'Premier League',
      home_team: 'Brighton',
      away_team: 'Fulham',
      odd_home: 2.15,
      odd_draw: 3.5,
      odd_away: 3.25,
      kickoff_time: '2026-11-28T12:00:00-03:00',
      status: 'SCHEDULED',
      home_score: null,
      away_score: null,
    },
    {
      id: 'f1-m3',
      matchday_id: 'fecha-1',
      order_index: 3,
      competition_name: 'Serie A',
      home_team: 'Fiorentina',
      away_team: 'Bologna',
      odd_home: 2.35,
      odd_draw: 3.2,
      odd_away: 3.1,
      kickoff_time: '2026-11-29T14:00:00-03:00',
      status: 'SCHEDULED',
      home_score: null,
      away_score: null,
    },
    {
      id: 'f1-m4',
      matchday_id: 'fecha-1',
      order_index: 4,
      competition_name: 'Liga Profesional',
      home_team: 'Huracan',
      away_team: 'Velez',
      odd_home: 2.6,
      odd_draw: 2.95,
      odd_away: 2.9,
      kickoff_time: '2026-11-28T21:15:00-03:00',
      status: 'SCHEDULED',
      home_score: null,
      away_score: null,
    },
    {
      id: 'f1-m5',
      matchday_id: 'fecha-1',
      order_index: 5,
      competition_name: 'Brasileirao',
      home_team: 'Internacional',
      away_team: 'Botafogo',
      odd_home: 2.4,
      odd_draw: 3.15,
      odd_away: 3.0,
      kickoff_time: '2026-11-29T18:30:00-03:00',
      status: 'SCHEDULED',
      home_score: null,
      away_score: null,
    },
    {
      id: 'f1-m6',
      matchday_id: 'fecha-1',
      order_index: 6,
      competition_name: 'Copa Libertadores',
      home_team: 'Atletico Mineiro',
      away_team: 'Racing Club',
      odd_home: 2.3,
      odd_draw: 3.1,
      odd_away: 3.2,
      kickoff_time: '2026-11-29T21:00:00-03:00',
      status: 'SCHEDULED',
      home_score: null,
      away_score: null,
    },
    {
      id: 'f1-m7',
      matchday_id: 'fecha-1',
      order_index: 7,
      competition_name: 'Primera Nacional',
      home_team: 'Colon',
      away_team: 'Deportivo Moron',
      odd_home: 2.1,
      odd_draw: 3.0,
      odd_away: 3.6,
      kickoff_time: '2026-11-28T19:10:00-03:00',
      status: 'SCHEDULED',
      home_score: null,
      away_score: null,
    },
    {
      id: 'f1-m8',
      matchday_id: 'fecha-1',
      order_index: 8,
      competition_name: 'Primera Nacional',
      home_team: 'San Martin Tucuman',
      away_team: 'Quilmes',
      odd_home: 2.05,
      odd_draw: 3.05,
      odd_away: 3.7,
      kickoff_time: '2026-11-29T17:00:00-03:00',
      status: 'SCHEDULED',
      home_score: null,
      away_score: null,
    },
    {
      id: 'f1-m9',
      matchday_id: 'fecha-1',
      order_index: 9,
      competition_name: 'EFL Championship',
      home_team: 'Sunderland',
      away_team: 'Coventry',
      odd_home: 2.3,
      odd_draw: 3.25,
      odd_away: 3.1,
      kickoff_time: '2026-11-28T12:00:00-03:00',
      status: 'SCHEDULED',
      home_score: null,
      away_score: null,
    },
    {
      id: 'f1-m10',
      matchday_id: 'fecha-1',
      order_index: 10,
      competition_name: 'Scottish Premiership',
      home_team: 'Hearts',
      away_team: 'Hibernian',
      odd_home: 2.45,
      odd_draw: 3.3,
      odd_away: 2.8,
      kickoff_time: '2026-11-29T12:30:00-03:00',
      status: 'SCHEDULED',
      home_score: null,
      away_score: null,
    },
  ];
}





// ============================================================================
// SECCIÓN 3: WHITELIST Y TABLA REINICIADA EN 0 PUNTOS PARA INICIO DE TORNEO
// ============================================================================

export const DEMO_ALLOWED_USERS: DemoAllowedUser[] = [
  { email: 'admin@gmail.com', nickname: 'El Admin', is_admin: true },
  { email: 'tincho@gmail.com', nickname: 'Tincho', is_admin: false },
  { email: 'santi@gmail.com', nickname: 'Santi', is_admin: false },
];

export const DEMO_INITIAL_USER_PREDICTIONS: UserPrediction[] = [];

export const DEMO_SPY_PREDICTIONS: Record<string, DemoFriendPrediction[]> = {};

export const DEMO_LEADERBOARD_GENERAL: LeaderboardEntry[] = [
  {
    id: 'demo-user-1',
    email: 'admin@gmail.com',
    display_name: 'El Admin',
    full_name: 'Matías Admin',
    avatar_url: null,
    exact_hits: 0,
    tendency_hits: 0,
    total_points: 0,
  },
  {
    id: 'demo-user-2',
    email: 'tincho@gmail.com',
    display_name: 'Tincho',
    full_name: 'Martín Gómez',
    avatar_url: null,
    exact_hits: 0,
    tendency_hits: 0,
    total_points: 0,
  },
  {
    id: 'demo-user-3',
    email: 'santi@gmail.com',
    display_name: 'Santi',
    full_name: 'Santiago Pérez',
    avatar_url: null,
    exact_hits: 0,
    tendency_hits: 0,
    total_points: 0,
  },
];

export const DEMO_LEADERBOARD_BY_MATCHDAY: MatchdayLeaderboardGroup[] = [
  {
    matchday_id: 'fecha-1',
    matchday_name: 'Fecha 1 · 25/11 al 02/12',
    entries: DEMO_LEADERBOARD_GENERAL,
  },
];

export type { MatchStatus };
