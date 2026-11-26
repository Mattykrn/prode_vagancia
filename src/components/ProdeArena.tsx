'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FixtureScreen,
  type MatchItem,
  type UserPrediction,
} from '@/components/fixture/FixtureScreen';
import {
  LeaderboardScreen,
  type LeaderboardEntry,
  type MatchdayLeaderboardGroup,
} from '@/components/ranking/LeaderboardScreen';
import { getPredictionLockState, formatLockCountdown } from '@/lib/scoring';
import type { Matchday } from '@/lib/types';

export interface AdminPredictionAuditRow {
  match_id: string;
  user_id: string;
  pred_home: number;
  pred_away: number;
  points_earned: number;
  player_name: string;
}

interface ProdeArenaProps {
  demoMode: boolean;
  userId: string;
  isAdmin: boolean;
  matchday: Matchday | null;
  matches: MatchItem[];
  predictions: UserPrediction[];
  generalLeaderboard: LeaderboardEntry[];
  matchdayLeaderboards: MatchdayLeaderboardGroup[];
  adminAllPredictions?: AdminPredictionAuditRow[];
}


export function ProdeArena({
  demoMode,
  userId,
  isAdmin,
  matchday,
  matches,
  predictions,
  generalLeaderboard,
  matchdayLeaderboards,
  adminAllPredictions,
}: ProdeArenaProps) {
  const [activeTab, setActiveTab] = useState<'carton' | 'ranking' | 'audit'>('carton');
  const hasAdminAudit = isAdmin && Array.isArray(adminAllPredictions);

  const [showCountdown, setShowCountdown] = useState(false);

  // Show countdown only when there's an active matchday with closes_at
  useEffect(() => {
    if (!matchday?.closes_at) return;

    const closesAt = new Date(matchday.closes_at);
    const now = new Date();
    const msUntilClose = closesAt.getTime() - now.getTime();

    if (msUntilClose > 0 && msUntilClose < 24 * 60 * 60 * 1000) {
      setShowCountdown(true);
    }
  }, [matchday?.closes_at]);

  // Compute lock state deterministically from current props
  // If no matchday is active, the prode is not closed globally
  const lockReason = matchday && matches[0]
    ? getPredictionLockState(
        matches[0].kickoff_time,
        matches[0].status,
        new Date(),
        matchday
      ).reason
    : 'OPEN';

  const isProdeClosed = lockReason === 'GLOBAL_CLOSE_REACHED';

  // If there's no active matchday, render a friendly message
  const noActiveMatchday = !matchday;

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-zinc-950 px-4 pb-28 pt-4 text-zinc-100">
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-[#0d2117] px-4 py-3 chalk-border">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
            El Potrero Prode
          </p>
          <p className="text-sm font-black text-white">
            {matchday?.name ?? 'Sin fecha activa'}
          </p>
        </div>

        {isAdmin && (
          <Link
            href="/admin"
            className="rounded-xl bg-amber-400 px-3 py-1.5 text-[11px] font-black text-zinc-950"
          >
            📋 Vestuario DT
          </Link>
        )}
      </div>

      {noActiveMatchday && (
        <div
          className="mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 p-3 chalk-border"
        >
          <div className="flex items-center gap-3">
            <span className="text-amber-400 text-xl font-black">ℹ️</span>
            <span className="text-zinc-200">
              <strong>Sin fecha publicada</strong> aún. El administrador debe crear
              una fecha desde el panel de admin (/admin) para habilitar los
              pronósticos.
            </span>
          </div>
        </div>
      )}

      {isProdeClosed && !noActiveMatchday && (
        <div className="mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 p-3 chalk-border">
          <div className="flex items-center gap-3">
            <span className="text-amber-400 text-xl font-black">🔒</span>
            <span className="text-zinc-200">
              <strong>Prode Cerrado</strong> — Los partidos están en juego. A medida que se
              carguen los resultados finales sumarás puntos automáticamente.
            </span>
          </div>
        </div>
      )}

      {!isProdeClosed && !noActiveMatchday && (
        <div
          className="mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 p-3 chalk-border"
        >
          <div className="flex items-center gap-3">
            <span className="text-amber-400 text-xl font-black">⏳</span>
            {showCountdown && matchday?.closes_at && (
              <span className="text-sm text-zinc-300">
                Cierre global a las{' '}
                <span className="font-mono text-amber-400">
                  {new Date(matchday.closes_at).toLocaleTimeString('es-AR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })} hs (ARG)
                </span>
                hace falta{' '}
                <span className="font-mono text-amber-400">
                  {showCountdown ? formatLockCountdown(
                    new Date(matchday.closes_at).getTime() - new Date().getTime()
                  ) : ''}
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Secciones principales de El Potrero Prode"
        className={`mb-4 grid gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-1.5 ${
          hasAdminAudit ? 'grid-cols-3' : 'grid-cols-2'
        }`}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'carton'}
          onClick={() => setActiveTab('carton')}
          className={`h-10 rounded-xl text-xs font-extrabold transition ${
            activeTab === 'carton'
              ? 'bg-emerald-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Cartón (10)
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ranking'}
          onClick={() => setActiveTab('ranking')}
          className={`h-10 rounded-xl text-xs font-extrabold transition ${
            activeTab === 'ranking'
              ? 'bg-emerald-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Posiciones
        </button>

        {hasAdminAudit && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'audit'}
            onClick={() => setActiveTab('audit')}
            className={`h-10 rounded-xl text-xs font-extrabold transition ${
              activeTab === 'audit'
                ? 'bg-amber-500 text-zinc-950 shadow'
                : 'text-amber-300/80 hover:text-amber-200'
            }`}
          >
            DT ({adminAllPredictions.length})
          </button>
        )}
      </div>

      {activeTab === 'carton' && (
        <FixtureScreen
          embedded
          demoMode={demoMode}
          userId={userId}
          matchday={matchday}
          initialMatches={matches}
          initialPredictions={predictions}
        />
      )}

      {activeTab === 'ranking' && (
        <LeaderboardScreen
          embedded
          currentUserId={userId}
          generalEntries={generalLeaderboard}
          matchdayGroups={matchdayLeaderboards}
        />
      )}

      {activeTab === 'audit' && hasAdminAudit && (
        <section className="space-y-3 rounded-2xl bg-[#0d2117] p-4 chalk-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-amber-400">
              Control DT · Pronósticos Cargados
            </h2>
            <span className="font-mono text-xs text-zinc-300 tabular-nums">
              {adminAllPredictions.length} registros
            </span>
          </div>

          {adminAllPredictions.length === 0 ? (
            <p className="py-6 text-center text-xs text-zinc-400">
              Todavía ningún jugador cargó pronósticos en esta fecha.
            </p>
          ) : (
            <ul className="space-y-2">
              {matches.map((match) => {
                const matchPreds = adminAllPredictions.filter(
                  (p) => p.match_id === match.id
                );

                return (
                  <li
                    key={match.id}
                    className={`rounded-xl border border-white/10 bg-black/40 p-3 ${
                      isProdeClosed ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <p className="text-xs font-bold text-white">
                      #{match.order_index} {match.home_team} vs {match.away_team}
                    </p>
                    {isProdeClosed ? (
                      <p className="mt-1 text-[11px] text-zinc-500">
                        Prode cerrado - Se suman puntos con resultados finales
                      </p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {matchPreds.map((pred) => (
                          <span
                            key={`${pred.match_id}-${pred.user_id}`}
                            className="rounded-lg bg-zinc-900 px-2 py-1 font-mono text-[11px] text-zinc-200 tabular-nums"
                          >
                            {pred.player_name}: {pred.pred_home}-{pred.pred_away}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}

export default ProdeArena;