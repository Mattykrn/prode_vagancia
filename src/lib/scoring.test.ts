// ============================================================================
// SECCIÓN 1: IMPORTACIONES Y DEPENDENCIAS DE PRUEBA
// ============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePredictionPoints,
  formatLockCountdown,
  getMatchdayVisibilityState,
  getPredictionLockState,
  type MatchdayWindow,
} from './scoring.ts';





// ============================================================================
// SECCIÓN 2: PRUEBAS UNITARIAS DE CÁLCULO DE PUNTAJE (3, 1, 0 PUNTOS)
// ============================================================================

describe('calculatePredictionPoints', () => {
  it('otorga 3 puntos (Pleno) al acertar marcador exacto de victoria local, visitante o empate', () => {
    assert.equal(calculatePredictionPoints({ home: 2, away: 1 }, { home: 2, away: 1 }), 3);
    assert.equal(calculatePredictionPoints({ home: 0, away: 3 }, { home: 0, away: 3 }), 3);
    assert.equal(calculatePredictionPoints({ home: 0, away: 0 }, { home: 0, away: 0 }), 3);
  });

  it('otorga 1 punto (Tendencia) al acertar ganador o empate sin acertar marcador exacto', () => {
    assert.equal(calculatePredictionPoints({ home: 2, away: 0 }, { home: 1, away: 0 }), 1);
    assert.equal(calculatePredictionPoints({ home: 1, away: 3 }, { home: 0, away: 1 }), 1);
    assert.equal(calculatePredictionPoints({ home: 1, away: 1 }, { home: 2, away: 2 }), 1);
  });

  it('otorga 0 puntos al fallar el ganador o empate', () => {
    assert.equal(calculatePredictionPoints({ home: 2, away: 1 }, { home: 1, away: 2 }), 0);
    assert.equal(calculatePredictionPoints({ home: 1, away: 1 }, { home: 1, away: 0 }), 0);
    assert.equal(calculatePredictionPoints({ home: 3, away: 0 }, { home: 0, away: 0 }), 0);
  });

  it('lanza RangeError si los goles son negativos o decimales', () => {
    assert.throws(
      () => calculatePredictionPoints({ home: -1, away: 0 }, { home: 1, away: 0 }),
      RangeError
    );
    assert.throws(
      () => calculatePredictionPoints({ home: 1.5, away: 0 }, { home: 1, away: 0 }),
      RangeError
    );
  });
});





// ============================================================================
// SECCIÓN 3: PRUEBAS DE VENTANAS DE APERTURA (opens_at), CIERRE GLOBAL Y -15 MIN
// ============================================================================

describe('getMatchdayVisibilityState y getPredictionLockState', () => {
  const kickoff = '2026-06-15T21:00:00.000Z';
  const openMatchday: MatchdayWindow = {
    status: 'OPEN',
    opensAt: '2026-06-14T12:00:00.000Z',
    closesAt: null,
  };

  it('oculta partidos si la fecha está en DRAFT o antes de opens_at', () => {
    const draftState = getMatchdayVisibilityState(
      { status: 'DRAFT', opensAt: '2026-06-14T12:00:00.000Z' },
      '2026-06-14T15:00:00.000Z'
    );
    assert.equal(draftState.isVisibleToPlayers, false);
    assert.equal(draftState.reason, 'DRAFT');

    const earlyState = getMatchdayVisibilityState(openMatchday, '2026-06-14T11:00:00.000Z');
    assert.equal(earlyState.isVisibleToPlayers, false);
    assert.equal(earlyState.reason, 'NOT_OPEN_YET');
    assert.equal(earlyState.msUntilOpen, 3600 * 1000);

    const lockBeforeOpen = getPredictionLockState(
      kickoff,
      'SCHEDULED',
      '2026-06-14T11:00:00.000Z',
      openMatchday
    );
    assert.equal(lockBeforeOpen.canEdit, false);
    assert.equal(lockBeforeOpen.canSpyPredictions, false);
    assert.equal(lockBeforeOpen.reason, 'MATCHDAY_NOT_OPEN');
  });

  it('permite editar hasta 15 minutos antes del kickoff y habilita Modo Espía al bloquearse', () => {
    const openState = getPredictionLockState(
      kickoff,
      'SCHEDULED',
      '2026-06-15T20:44:59.000Z',
      openMatchday
    );
    assert.equal(openState.canEdit, true);
    assert.equal(openState.canSpyPredictions, false);
    assert.equal(openState.msUntilLock, 1000);

    const cutoffState = getPredictionLockState(
      kickoff,
      'SCHEDULED',
      '2026-06-15T20:45:00.000Z',
      openMatchday
    );
    assert.equal(cutoffState.canEdit, false);
    assert.equal(cutoffState.isLocked, true);
    assert.equal(cutoffState.canSpyPredictions, true);
    assert.equal(cutoffState.reason, 'LOCKED_CUTOFF');
  });

  it('respeta closes_at global cuando cierra antes que kickoff - 15m', () => {
    const matchdayWithGlobalClose: MatchdayWindow = {
      status: 'OPEN',
      opensAt: '2026-06-14T12:00:00.000Z',
      closesAt: '2026-06-15T18:00:00.000Z',
    };

    const beforeGlobal = getPredictionLockState(
      kickoff,
      'SCHEDULED',
      '2026-06-15T17:59:00.000Z',
      matchdayWithGlobalClose
    );
    assert.equal(beforeGlobal.canEdit, true);
    assert.equal(beforeGlobal.msUntilLock, 60 * 1000);

    const afterGlobal = getPredictionLockState(
      kickoff,
      'SCHEDULED',
      '2026-06-15T18:00:00.000Z',
      matchdayWithGlobalClose
    );
    assert.equal(afterGlobal.canEdit, false);
    assert.equal(afterGlobal.canSpyPredictions, true);
    assert.equal(afterGlobal.reason, 'GLOBAL_CLOSE_REACHED');
  });

  it('mantiene bloqueado y con Modo Espía en fechas CLOSED y partidos FINISHED', () => {
    const closedMd = getPredictionLockState(kickoff, 'SCHEDULED', '2026-06-15T15:00:00.000Z', {
      status: 'CLOSED',
      opensAt: '2026-06-14T12:00:00.000Z',
    });
    assert.equal(closedMd.canEdit, false);
    assert.equal(closedMd.canSpyPredictions, true);
    assert.equal(closedMd.reason, 'MATCHDAY_CLOSED');

    const finishedState = getPredictionLockState(kickoff, 'FINISHED', '2026-06-15T23:00:00.000Z', openMatchday);
    assert.equal(finishedState.canEdit, false);
    assert.equal(finishedState.canSpyPredictions, true);
    assert.equal(finishedState.reason, 'MATCH_FINISHED');
  });
});





// ============================================================================
// SECCIÓN 4: PRUEBAS UNITARIAS DEL CONTADOR REGRESIVO
// ============================================================================

describe('formatLockCountdown', () => {
  it('formatea correctamente días, horas, minutos y cierre', () => {
    assert.equal(formatLockCountdown(0), 'Cerrado');
    assert.equal(formatLockCountdown(5 * 60 * 1000 + 9 * 1000), '05:09');
    assert.equal(formatLockCountdown(2 * 3600 * 1000 + 7 * 60 * 1000), '2h 07m');
    assert.equal(formatLockCountdown(26 * 3600 * 1000), '1d 2h');
  });
});
