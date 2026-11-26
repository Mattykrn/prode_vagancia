// ============================================================================
// SECCIÓN 1: TIPOS Y CONSTANTES DEL DOMINIO DE PUNTAJES Y VENTANAS DE FECHA
// ============================================================================

export const PREDICTION_LOCK_MINUTES = 15;
export const PREDICTION_LOCK_MS = PREDICTION_LOCK_MINUTES * 60 * 1000;

export type MatchdayStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'FINISHED';
export type MatchStatus = 'SCHEDULED' | 'FINISHED';
export type MatchOutcome = 'HOME_WIN' | 'DRAW' | 'AWAY_WIN';
export type PointsAwarded = 0 | 1 | 3;

export interface MatchScore {
  home: number;
  away: number;
}

export interface MatchdayWindow {
  status: MatchdayStatus;
  opensAt: Date | string;
  closesAt?: Date | string | null;
}

export type LockReason =
  | 'OPEN'
  | 'MATCHDAY_DRAFT'
  | 'MATCHDAY_NOT_OPEN'
  | 'MATCHDAY_CLOSED'
  | 'GLOBAL_CLOSE_REACHED'
  | 'LOCKED_CUTOFF'
  | 'MATCH_FINISHED';

export interface MatchdayVisibilityState {
  isVisibleToPlayers: boolean;
  isAcceptingPredictions: boolean;
  opensAt: Date;
  closesAt: Date | null;
  msUntilOpen: number;
  msUntilGlobalClose: number | null;
  reason: 'VISIBLE_OPEN' | 'VISIBLE_CLOSED' | 'DRAFT' | 'NOT_OPEN_YET';
}

export interface PredictionLockState {
  canEdit: boolean;
  isLocked: boolean;
  canSpyPredictions: boolean;
  lockAt: Date;
  msUntilLock: number;
  reason: LockReason;
}





// ============================================================================
// SECCIÓN 2: VALIDACIÓN DE MARCADORES Y TENDENCIA DEL RESULTADO
// ============================================================================

function assertValidGoals(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(
      `El valor de ${label} debe ser un entero mayor o igual a 0. Recibido: ${value}`
    );
  }
}

export function getMatchOutcome(score: MatchScore): MatchOutcome {
  assertValidGoals(score.home, 'goles local');
  assertValidGoals(score.away, 'goles visitante');

  if (score.home > score.away) {
    return 'HOME_WIN';
  }

  if (score.home < score.away) {
    return 'AWAY_WIN';
  }

  return 'DRAW';
}





// ============================================================================
// SECCIÓN 3: CÁLCULO EXACTO DE PUNTAJE (3 PLENO / 1 TENDENCIA / 0 FALLO)
// ============================================================================

export function calculatePredictionPoints(
  prediction: MatchScore,
  actual: MatchScore
): PointsAwarded {
  assertValidGoals(prediction.home, 'pronóstico local');
  assertValidGoals(prediction.away, 'pronóstico visitante');
  assertValidGoals(actual.home, 'marcador real local');
  assertValidGoals(actual.away, 'marcador real visitante');

  if (prediction.home === actual.home && prediction.away === actual.away) {
    return 3;
  }

  if (getMatchOutcome(prediction) === getMatchOutcome(actual)) {
    return 1;
  }

  return 0;
}





// ============================================================================
// SECCIÓN 4: VALIDACIÓN DE VENTANAS DE FECHA (opens_at, closes_at) Y CIERRE -15M
// ============================================================================

function toValidDate(input: Date | string, label: string): Date {
  const parsed = input instanceof Date ? new Date(input.getTime()) : new Date(input);

  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError(`Fecha inválida para ${label}: ${String(input)}`);
  }

  return parsed;
}

export function getMatchdayVisibilityState(
  matchday: MatchdayWindow,
  now: Date | string = new Date()
): MatchdayVisibilityState {
  const nowMs = toValidDate(now, 'now').getTime();
  const opensAt = toValidDate(matchday.opensAt, 'opensAt');
  const closesAt =
    matchday.closesAt != null ? toValidDate(matchday.closesAt, 'closesAt') : null;

  const msUntilOpen = Math.max(0, opensAt.getTime() - nowMs);
  const msUntilGlobalClose =
    closesAt != null ? Math.max(0, closesAt.getTime() - nowMs) : null;

  if (matchday.status === 'DRAFT') {
    return {
      isVisibleToPlayers: false,
      isAcceptingPredictions: false,
      opensAt,
      closesAt,
      msUntilOpen,
      msUntilGlobalClose,
      reason: 'DRAFT',
    };
  }

  if (nowMs < opensAt.getTime()) {
    return {
      isVisibleToPlayers: false,
      isAcceptingPredictions: false,
      opensAt,
      closesAt,
      msUntilOpen,
      msUntilGlobalClose,
      reason: 'NOT_OPEN_YET',
    };
  }

  if (
    matchday.status === 'CLOSED' ||
    matchday.status === 'FINISHED' ||
    (closesAt != null && nowMs >= closesAt.getTime())
  ) {
    return {
      isVisibleToPlayers: true,
      isAcceptingPredictions: false,
      opensAt,
      closesAt,
      msUntilOpen: 0,
      msUntilGlobalClose: 0,
      reason: 'VISIBLE_CLOSED',
    };
  }

  return {
    isVisibleToPlayers: true,
    isAcceptingPredictions: true,
    opensAt,
    closesAt,
    msUntilOpen: 0,
    msUntilGlobalClose,
    reason: 'VISIBLE_OPEN',
  };
}

export function getPredictionLockState(
  kickoffTime: Date | string,
  status: MatchStatus,
  now: Date | string = new Date(),
  matchday?: MatchdayWindow
): PredictionLockState {
  const kickoffMs = toValidDate(kickoffTime, 'kickoffTime').getTime();
  const nowMs = toValidDate(now, 'now').getTime();
  const matchLockMs = kickoffMs - PREDICTION_LOCK_MS;

  const closesAtMs =
    matchday?.closesAt != null
      ? toValidDate(matchday.closesAt, 'closesAt').getTime()
      : null;

  const effectiveLockMs =
    closesAtMs !== null ? Math.min(matchLockMs, closesAtMs) : matchLockMs;
  const lockAt = new Date(effectiveLockMs);

  if (matchday) {
    const opensAtMs = toValidDate(matchday.opensAt, 'opensAt').getTime();

    if (matchday.status === 'DRAFT') {
      return {
        canEdit: false,
        isLocked: true,
        canSpyPredictions: false,
        lockAt,
        msUntilLock: 0,
        reason: 'MATCHDAY_DRAFT',
      };
    }

    if (nowMs < opensAtMs) {
      return {
        canEdit: false,
        isLocked: true,
        canSpyPredictions: false,
        lockAt,
        msUntilLock: 0,
        reason: 'MATCHDAY_NOT_OPEN',
      };
    }

    if (matchday.status === 'CLOSED' || matchday.status === 'FINISHED') {
      return {
        canEdit: false,
        isLocked: true,
        canSpyPredictions: true,
        lockAt,
        msUntilLock: 0,
        reason: 'MATCHDAY_CLOSED',
      };
    }
  }

  if (status === 'FINISHED') {
    return {
      canEdit: false,
      isLocked: true,
      canSpyPredictions: true,
      lockAt,
      msUntilLock: 0,
      reason: 'MATCH_FINISHED',
    };
  }

  if (closesAtMs !== null && nowMs >= closesAtMs) {
    return {
      canEdit: false,
      isLocked: true,
      canSpyPredictions: true,
      lockAt,
      msUntilLock: 0,
      reason: 'GLOBAL_CLOSE_REACHED',
    };
  }

  if (nowMs >= matchLockMs) {
    return {
      canEdit: false,
      isLocked: true,
      canSpyPredictions: true,
      lockAt,
      msUntilLock: 0,
      reason: 'LOCKED_CUTOFF',
    };
  }

  return {
    canEdit: true,
    isLocked: false,
    canSpyPredictions: false,
    lockAt,
    msUntilLock: effectiveLockMs - nowMs,
    reason: 'OPEN',
  };
}





// ============================================================================
// SECCIÓN 5: FORMATEO DE CONTADOR REGRESIVO PARA LA INTERFAZ MÓVIL
// ============================================================================

export function formatLockCountdown(msUntilLock: number): string {
  if (msUntilLock <= 0) {
    return 'Cerrado';
  }

  const totalSeconds = Math.floor(msUntilLock / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
