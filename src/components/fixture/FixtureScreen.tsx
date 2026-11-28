// ============================================================================
// SECCIÓN 1: IMPORTACIONES Y TIPOS DEL CARTÓN DE LA FECHA (10 PARTIDOS)
// ============================================================================

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  formatLockCountdown,
  getMatchdayVisibilityState,
  getPredictionLockState,
  type MatchdayWindow,
  type MatchdayStatus,
  type MatchStatus,
} from '@/lib/scoring';
import { areBetsOpen } from '@/lib/team-normalization';

export interface MatchdayRecord { id: string; name: string; status: MatchdayStatus; opens_at: string; closes_at: string | null; }
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

export interface UserPrediction {
  match_id: string;
  pred_home: number;
  pred_away: number;
  points_earned: number;
}

interface DraftScore {
  home: number;
  away: number;
}

interface SpyPredictionRow {
  user_id: string;
  pred_home: number;
  pred_away: number;
  points_earned: number;
  profile: {
    full_name: string;
    avatar_url: string | null;
  } | null;
}

interface FixtureScreenProps {
  demoMode?: boolean;
  embedded?: boolean;
  userId: string;
  matchday: MatchdayRecord | null;
  initialMatches: MatchItem[];
  initialPredictions: UserPrediction[];
}





// ============================================================================
// SECCIÓN 2: UTILIDADES DE FORMATO DE FECHA Y CUOTAS DE REFERENCIA
// ============================================================================

function formatMatchDateTime(isoDate: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(isoDate));
}

function formatFullOpenDate(isoDate: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(isoDate));
}

function formatOdd(value: number | null): string {
  return value !== null && Number.isFinite(value) ? Number(value).toFixed(2) : '-';
}





// ============================================================================
// SECCIÓN 3: MODAL DE MODO ESPÍA (POST-BLOQUEO)
// ============================================================================

function PredictionsSpyModal({
  match,
  demoMode,
  onClose,
}: {
  match: MatchItem;
  demoMode: boolean;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<SpyPredictionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadFriendPredictions() {
      setLoading(true);
      setError(null);

      if (demoMode) {
        setRows([]);
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from('predictions')
        .select(
          'user_id, pred_home, pred_away, points_earned, profile:profiles(full_name, avatar_url)'
        )
        .eq('match_id', match.id)
        .order('points_earned', { ascending: false });

      if (!active) return;

      if (queryError) {
        setError('No se pudieron cargar los pronósticos del grupo.');
      } else {
        setRows((data as unknown as SpyPredictionRow[]) ?? []);
      }

      setLoading(false);
    }

    loadFriendPredictions();

    return () => {
      active = false;
    };
  }, [match.id, demoMode]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Modo Espía de pronósticos"
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3 border-b border-zinc-800 pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Modo Espía · Pronósticos del Grupo
            </p>
            <h3 className="mt-0.5 text-base font-bold text-white">
              {match.home_team} vs {match.away_team}
            </h3>
            {match.odd_home !== null && (
              <p className="mt-0.5 font-mono text-[11px] text-zinc-400 tabular-nums">
                {`L ${formatOdd(match.odd_home)} | E ${formatOdd(match.odd_draw)} | V ${formatOdd(match.odd_away)}`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
          >
            Cerrar
          </button>
        </div>

        {loading && (
          <p className="py-8 text-center text-sm text-zinc-400">Cargando pronósticos...</p>
        )}

        {error && (
          <p className="rounded-xl bg-red-950/50 p-3 text-center text-sm text-red-300">{error}</p>
        )}

        {!loading && !error && rows.length === 0 && (
          <p className="py-8 text-center text-sm text-zinc-400">
            Nadie cargó pronóstico para este partido.
          </p>
        )}

        {!loading && !error && rows.length > 0 && (
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {rows.map((row) => (
              <li
                key={row.user_id}
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {row.profile?.avatar_url ? (
                    <img
                      src={row.profile.avatar_url}
                      alt={row.profile.full_name}
                      className="h-8 w-8 rounded-full object-cover ring-1 ring-zinc-700"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-200">
                      {(row.profile?.full_name ?? '?').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="truncate text-sm font-medium text-zinc-100">
                    {row.profile?.full_name ?? 'Jugador'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-zinc-800 px-2.5 py-1 font-mono text-sm font-bold text-white tabular-nums">
                    {row.pred_home} - {row.pred_away}
                  </span>
                  {match.status === 'FINISHED' && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                        row.points_earned === 3
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : row.points_earned === 1
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      +{row.points_earned}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}





// ============================================================================
// SECCIÓN 4: TARJETA INDIVIDUAL DEL CARTÓN CON CUOTAS OPCIONALES Y +/-
// ============================================================================

function MatchCard({
  match,
  matchdayWindow,
  draft,
  savedPrediction,
  isDirty,
  now,
  betsClosed,
  onChangeDraft,
  onOpenSpy,
}: {
  match: MatchItem;
  matchdayWindow: MatchdayWindow;
  draft: DraftScore;
  savedPrediction?: UserPrediction;
  isDirty: boolean;
  now: Date;
  betsClosed: boolean;
  onChangeDraft: (matchId: string, next: DraftScore) => void;
  onOpenSpy: (match: MatchItem) => void;
}) {
  const rawLockState = getPredictionLockState(
    match.kickoff_time,
    match.status,
    now,
    matchdayWindow
  );

  // Si ya pasó el kickoff más temprano de la grilla, forzamos el cierre global
  // de apuestas aunque este partido en particular todavía no haya arrancado.
  const lockState =
    betsClosed && rawLockState.canEdit
      ? {
          ...rawLockState,
          canEdit: false,
          isLocked: true,
          msUntilLock: 0,
          reason: 'LOCKED_CUTOFF' as const,
        }
      : rawLockState;

  function adjust(side: 'home' | 'away', delta: number) {
    if (!lockState.canEdit) return;
    if (side === 'home') {
      onChangeDraft(match.id, {
        home: Math.max(0, Math.min(20, draft.home + delta)),
        away: draft.away,
      });
    } else {
      onChangeDraft(match.id, {
        home: draft.home,
        away: Math.max(0, Math.min(20, draft.away + delta)),
      });
    }
  }

  function handleNumericInput(side: 'home' | 'away', raw: string) {
    if (!lockState.canEdit) return;
    const digits = raw.replace(/\D/g, '');
    const parsed = digits === '' ? 0 : Math.min(20, Number.parseInt(digits, 10));

    if (side === 'home') {
      onChangeDraft(match.id, { home: parsed, away: draft.away });
    } else {
      onChangeDraft(match.id, { home: draft.home, away: parsed });
    }
  }

  return (
    <article
      className={`rounded-2xl border bg-zinc-900/90 p-4 shadow-lg transition ${
        isDirty && lockState.canEdit
          ? 'border-emerald-500/60'
          : 'border-zinc-800/90'
      }`}
    >
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="font-mono text-[11px] font-bold text-zinc-500">
            #{String(match.order_index).padStart(2, '0')}
          </span>
          <span className="truncate rounded-full border border-zinc-700 bg-zinc-800/80 px-2.5 py-0.5 text-[11px] font-bold text-zinc-200">
            {match.competition_name}
          </span>
        </div>

        {match.status === 'FINISHED' ? (
          <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-300">
            FINALIZADO
          </span>
        ) : lockState.canEdit ? (
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-300 tabular-nums">
            Cierra en {formatLockCountdown(lockState.msUntilLock)}
          </span>
        ) : (
          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
            {lockState.reason === 'GLOBAL_CLOSE_REACHED'
              ? 'Cierre global'
              : lockState.reason === 'LOCKED_CUTOFF'
                ? 'Cierre de apuestas'
                : 'Cerrado (15 min)'}
          </span>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/70 px-3 py-1.5 text-[11px]">
        <span className="capitalize text-zinc-400">
          {formatMatchDateTime(match.kickoff_time)} hs
        </span>
        {match.odd_home !== null && match.odd_draw !== null && match.odd_away !== null && (
          <span className="font-mono font-semibold text-zinc-200 tabular-nums">
            {`L ${formatOdd(match.odd_home)} | E ${formatOdd(match.odd_draw)} | V ${formatOdd(match.odd_away)}`}
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1">
        <span className="text-center text-sm font-extrabold text-zinc-100">
          {match.home_team}
        </span>

        {match.home_score !== null && match.away_score !== null ? (
          <div className="rounded-xl bg-zinc-950 px-3 py-1.5 font-mono text-lg font-extrabold text-white ring-1 ring-zinc-800 tabular-nums">
            {match.home_score} - {match.away_score}
          </div>
        ) : (
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">VS</span>
        )}

        <span className="text-center text-sm font-extrabold text-zinc-100">
          {match.away_team}
        </span>
      </div>

      <div className="mt-3.5 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
        <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-zinc-400">
          <span>Tu pronóstico</span>
          {match.status === 'FINISHED' && savedPrediction ? (
            <span
              className={`rounded-full px-2 py-0.5 font-bold ${
                savedPrediction.points_earned === 3
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : savedPrediction.points_earned === 1
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              {savedPrediction.points_earned === 3
                ? '+3 pts · Pleno'
                : savedPrediction.points_earned === 1
                  ? '+1 pt · Tendencia'
                  : '0 pts'}
            </span>
          ) : isDirty && lockState.canEdit ? (
            <span className="font-bold text-emerald-400">Sin guardar</span>
          ) : savedPrediction ? (
            <span className="font-semibold text-zinc-400">Guardado ✓</span>
          ) : (
            <span className="text-zinc-500">Pendiente</span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-1 items-center justify-center gap-1.5">
            <button
              type="button"
              disabled={!lockState.canEdit}
              onClick={() => adjust('home', -1)}
              aria-label={`Restar gol a ${match.home_team}`}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-lg font-bold text-white active:scale-95 disabled:opacity-35"
            >
              −
            </button>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              readOnly={!lockState.canEdit}
              value={draft.home}
              onChange={(e) => handleNumericInput('home', e.target.value)}
              aria-label={`Goles pronosticados para ${match.home_team}`}
              className="h-11 w-12 rounded-xl border border-zinc-700 bg-zinc-900 text-center font-mono text-xl font-extrabold text-white tabular-nums focus:border-emerald-500 focus:outline-none read-only:border-zinc-800 read-only:text-zinc-400"
            />
            <button
              type="button"
              disabled={!lockState.canEdit}
              onClick={() => adjust('home', 1)}
              aria-label={`Sumar gol a ${match.home_team}`}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-lg font-bold text-white active:scale-95 disabled:opacity-35"
            >
              +
            </button>
          </div>

          <span className="font-mono text-lg font-bold text-zinc-600">-</span>

          <div className="flex flex-1 items-center justify-center gap-1.5">
            <button
              type="button"
              disabled={!lockState.canEdit}
              onClick={() => adjust('away', -1)}
              aria-label={`Restar gol a ${match.away_team}`}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-lg font-bold text-white active:scale-95 disabled:opacity-35"
            >
              −
            </button>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              readOnly={!lockState.canEdit}
              value={draft.away}
              onChange={(e) => handleNumericInput('away', e.target.value)}
              aria-label={`Goles pronosticados para ${match.away_team}`}
              className="h-11 w-12 rounded-xl border border-zinc-700 bg-zinc-900 text-center font-mono text-xl font-extrabold text-white tabular-nums focus:border-emerald-500 focus:outline-none read-only:border-zinc-800 read-only:text-zinc-400"
            />
            <button
              type="button"
              disabled={!lockState.canEdit}
              onClick={() => adjust('away', 1)}
              aria-label={`Sumar gol a ${match.away_team}`}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-lg font-bold text-white active:scale-95 disabled:opacity-35"
            >
              +
            </button>
          </div>
        </div>

        {lockState.canSpyPredictions && (
          <button
            type="button"
            onClick={() => onOpenSpy(match)}
            className="mt-3 h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-xs font-bold text-zinc-100 transition hover:border-emerald-500/60 hover:text-emerald-300"
          >
            Espiar pronósticos del grupo
          </button>
        )}
      </div>
    </article>
  );
}





// ============================================================================
// SECCIÓN 5: CARTÓN COMPLETO CON AVISO DE APERTURA Y GUARDADO MASIVO
// ============================================================================

export function FixtureScreen({
  demoMode = false,
  embedded = false,
  userId,
  matchday,
  initialMatches,
  initialPredictions,
}: FixtureScreenProps) {
  const [spyMatch, setSpyMatch] = useState<MatchItem | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const [savingAll, setSavingAll] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const [savedMap, setSavedMap] = useState<Record<string, UserPrediction>>(() => {
    const map: Record<string, UserPrediction> = {};
    for (const pred of initialPredictions) {
      map[pred.match_id] = pred;
    }
    // Asegurar que todos los partidos de la fecha estén en el mapa,
    // aunque no tengan pronóstico guardado aún
    for (const match of initialMatches) {
      if (!map[match.id]) {
        map[match.id] = { match_id: match.id, pred_home: 0, pred_away: 0, points_earned: 0 } as UserPrediction;
      }
    }
    return map;
  });

  const [drafts, setDrafts] = useState<Record<string, DraftScore>>(() => {
    const map: Record<string, DraftScore> = {};
    for (const match of initialMatches) {
      const saved = initialPredictions.find((p) => p.match_id === match.id);
      map[match.id] = {
        home: saved?.pred_home ?? 0,
        away: saved?.pred_away ?? 0,
      };
    }
    return map;
  });

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const matchdayWindow: MatchdayWindow | null = matchday
    ? {
        status: matchday.status,
        opens_at: matchday.opens_at,
        closes_at: matchday.closes_at,
      }
    : null;

  const visibility = matchdayWindow
    ? getMatchdayVisibilityState(matchdayWindow, now)
    : null;

  const sortedMatches = useMemo(
    () => [...initialMatches].sort((a, b) => a.order_index - b.order_index),
    [initialMatches]
  );

  // Cierre de apuestas global: se toma el kickoff más temprano de toda la grilla.
  // Cuando ese instante pasa, ninguna predicción puede crearse ni editarse.
  const betsClosed = useMemo(() => {
    if (sortedMatches.length === 0) return false;
    return !areBetsOpen(
      sortedMatches.map((match) => ({ kickoff_time: match.kickoff_time })),
      now
    );
  }, [sortedMatches, now]);

  const editableMatchIds = useMemo(() => {
    if (!matchdayWindow || betsClosed) return [];

    return sortedMatches
      .filter((match) => {
        const lock = getPredictionLockState(
          match.kickoff_time,
          match.status,
          now,
          matchdayWindow
        );
        return lock.canEdit;
      })
      .map((m) => m.id);
  }, [sortedMatches, now, matchdayWindow, betsClosed]);

  const dirtyOpenMatchIds = useMemo(() => {
    if (!matchdayWindow || betsClosed) return [];

    return sortedMatches
      .filter((match) => {
        const lock = getPredictionLockState(
          match.kickoff_time,
          match.status,
          now,
          matchdayWindow
        );
        if (!lock.canEdit) return false;
        const draft = drafts[match.id] ?? { home: 0, away: 0 };
        const saved = savedMap[match.id];
        return !saved || saved.pred_home !== draft.home || saved.pred_away !== draft.away;
      })
      .map((m) => m.id);
  }, [sortedMatches, drafts, savedMap, now, matchdayWindow, betsClosed]);

  function handleDraftChange(matchId: string, next: DraftScore) {
    setBanner(null);
    setDrafts((prev) => ({ ...prev, [matchId]: next }));
  }

  async function handleSaveAllPredictions() {
    if (savingAll) return;

    // Si ya pasó el kickoff más temprano de la grilla, no se permite guardar.
    if (betsClosed) {
      setBanner({
        type: 'error',
        text: 'Las apuestas ya cerraron: pasó el horario del primer partido de la fecha.',
      });
      return;
    }

    setSavingAll(true);
    setBanner(null);

    // Siempre guardar los 10 partidos de la fecha, aunque algunos ya estén guardados
    const payload = initialMatches.map((match) => {
      const score = drafts[match.id] ?? { home: 0, away: 0 };
      return {
        user_id: userId,
        match_id: match.id,
        pred_home: score.home,
        pred_away: score.away,
        points_earned: 0,
        updated_at: new Date().toISOString(),
      };
    });

    if (!demoMode) {
      const supabase = createClient();
      const { error } = await supabase
        .from('predictions')
        .upsert(payload, { onConflict: 'user_id,match_id' });

      if (error) {
        setSavingAll(false);
        setBanner({
          type: 'error',
          text: `Error guardando pronósticos: ${error.message} (código: ${error.code})`,
        });
        return;
      }
    }

    // Actualizar el savedMap con los nuevos valores
    setSavedMap((prev) => {
      const next = { ...prev };
      for (const row of payload) {
        next[row.match_id] = {
          match_id: row.match_id,
          pred_home: row.pred_home,
          pred_away: row.pred_away,
          points_earned: prev[row.match_id]?.points_earned ?? 0,
        };
      }
      return next;
    });

    setSavingAll(false);
    setBanner({
      type: 'ok',
      text: `Se guardaron ${payload.length} pronóstico(s) correctamente ✓`,
    });
  }

  const wrapperClass = embedded
    ? 'text-zinc-100'
    : 'mx-auto min-h-screen max-w-xl bg-zinc-950 px-4 pb-28 pt-5 text-zinc-100';

  if (!matchday || !matchdayWindow || !visibility) {
    return (
      <div className={wrapperClass}>
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            Prode Privado
          </p>
          <h2 className="mt-2 text-xl font-extrabold text-white">
            Todavía no hay una fecha cargada
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            El administrador está preparando el próximo cartón de 10 partidos.
          </p>
        </div>
      </div>
    );
  }

  if (!visibility.isVisibleToPlayers) {
    return (
      <div className={wrapperClass}>
        <div className="rounded-3xl border border-amber-500/30 bg-zinc-900/90 p-7 text-center shadow-2xl">
          <span className="inline-block rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-300">
            {matchday.status === 'DRAFT' ? 'En preparación' : 'Próxima apertura'}
          </span>
          <h2 className="mt-3 text-xl font-extrabold text-white">{matchday.name}</h2>
          <p className="mt-2 text-sm font-semibold text-zinc-200">
            Próxima fecha disponible el {formatFullOpenDate(matchday.opens_at)} hs
          </p>
          {visibility.msUntilOpen > 0 && (
            <p className="mt-3 font-mono text-lg font-extrabold text-emerald-400 tabular-nums">
              Faltan {formatLockCountdown(visibility.msUntilOpen)}
            </p>
          )}
        </div>
      </div>
    );
  }

  const savedCount = Object.keys(savedMap).length;

  return (
    <div className={wrapperClass}>
      <header className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
            Estado: {matchday.status}
          </span>
          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-0.5 font-mono text-xs font-bold text-zinc-200 tabular-nums">
            {savedCount}/{sortedMatches.length} cargados
          </span>
        </div>

        <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-white">
          {matchday.name}
        </h2>

        <p className="mt-1 text-xs text-zinc-400">
          {matchday.closes_at
            ? `Cierre global: ${formatMatchDateTime(matchday.closes_at)} hs · o 15 min antes de cada partido.`
            : 'Cada partido bloquea pronósticos 15 minutos antes de su inicio.'}
        </p>
      </header>

      {betsClosed && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3">
          <span className="text-xl font-black text-amber-400">🔒</span>
          <span className="text-sm text-zinc-200">
            <strong>Apuestas cerradas</strong> — Ya arrancó el primer partido de la
            fecha (kickoff más temprano). No se pueden crear ni editar pronósticos.
          </span>
        </div>
      )}

      <div className="sticky top-2 z-30 mb-4 rounded-2xl border border-zinc-800 bg-zinc-950/95 p-2.5 shadow-xl backdrop-blur-md">
        <button
          type="button"
          disabled={savingAll || betsClosed}
          onClick={handleSaveAllPredictions}
          className="h-11 w-full rounded-xl bg-emerald-500 px-4 text-sm font-extrabold text-zinc-950 transition hover:bg-emerald-400 active:scale-[0.99] disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          {savingAll
            ? 'Guardando cartón...'
            : betsClosed
              ? 'Apuestas cerradas · Arrancó el primer partido'
              : editableMatchIds.length > 0
                ? `Guardar Pronósticos (${editableMatchIds.length} pendiente${editableMatchIds.length > 1 ? 's' : ''})`
                : 'Guardar Pronósticos · Todo al día ✓'}
        </button>

        {banner && (
          <p
            className={`mt-2 text-center text-xs font-semibold ${
              banner.type === 'ok' ? 'text-emerald-300' : 'text-red-400'
            }`}
          >
            {banner.text}
          </p>
        )}
      </div>

      <div className="space-y-3.5">
        {sortedMatches.map((match) => {
          const draft = drafts[match.id] ?? { home: 0, away: 0 };
          const saved = savedMap[match.id];
          const isDirty =
            !saved || saved.pred_home !== draft.home || saved.pred_away !== draft.away;

          return (
            <MatchCard
              key={match.id}
              match={match}
              matchdayWindow={matchdayWindow}
              draft={draft}
              savedPrediction={saved}
              isDirty={isDirty}
              now={now}
              betsClosed={betsClosed}
              onChangeDraft={handleDraftChange}
              onOpenSpy={setSpyMatch}
            />
          );
        })}
      </div>

      {spyMatch && (
        <PredictionsSpyModal
          match={spyMatch}
          demoMode={demoMode}
          onClose={() => setSpyMatch(null)}
        />
      )}
    </div>
  );
}
