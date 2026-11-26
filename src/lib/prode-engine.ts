// ============================================================================
// SECCIÓN 1: RE-EXPORTACIÓN UNIFICADA DEL MOTOR DEL PRODE (@/lib/prode-engine)
// ============================================================================

import {
  parseBulkMatchesText,
  type ParsedBulkMatch,
} from '@/lib/bulk-match-parser';
import {
  calculatePredictionPoints,
  formatLockCountdown,
  getMatchdayVisibilityState,
  getPredictionLockState,
  type MatchdayStatus,
  type MatchStatus,
} from '@/lib/scoring';

export interface Matchday {
  id: string;
  name: string;
  status: MatchdayStatus;
  opens_at: string;
  closes_at: string | null;
}

export interface MatchItem {
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

export interface BulkInputResult {
  matches: ParsedBulkMatch[];
  errors: string[];
}





// ============================================================================
// SECCIÓN 2: ADAPTADOR parseBulkMatchesInput Y EXPORTACIONES DEL MOTOR
// ============================================================================

export function parseBulkMatchesInput(
  rawText: string,
  startOrderIndex = 1,
  maxMatches = 10
): BulkInputResult {
  const { matches, errors } = parseBulkMatchesText(rawText, {
    startOrderIndex,
    maxMatches,
  });

  return {
    matches,
    errors: errors.map((e) => `Línea ${e.lineNumber}: ${e.message}`),
  };
}

export {
  calculatePredictionPoints,
  formatLockCountdown,
  getMatchdayVisibilityState,
  getPredictionLockState,
};

