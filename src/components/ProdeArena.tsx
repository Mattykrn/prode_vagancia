// ============================================================================
// SECCIÓN 1: IMPORTACIONES Y TIPOS DE PRODE ARENA (CARTÓN + TABLA + VISTA ADMIN)
// ============================================================================

'use client';

import React, { useState } from 'react';
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
import type { MatchdayRecord } from '@/lib/demo-data';

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
  matchday: MatchdayRecord | null;
  matches: MatchItem[];
  predictions: UserPrediction[];
  generalLeaderboard: LeaderboardEntry[];
  matchdayLeaderboards: MatchdayLeaderboardGroup[];
  adminAllPredictions?: AdminPredictionAuditRow[];
}





// ============================================================================
// SECCIÓN 2: COMPONENTE PRINCIPAL ProdeArena (CANCHA + POSICIONES + AUDITORÍA DT)
// ============================================================================

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
                ? 'bg-amber-400 text-zinc-950 shadow'
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
                    className="rounded-xl border border-white/10 bg-black/40 p-3"
                  >
                    <p className="text-xs font-bold text-white">
                      #{match.order_index} {match.home_team} vs {match.away_team}
                    </p>
                    {matchPreds.length === 0 ? (
                      <p className="mt-1 text-[11px] text-zinc-500">Sin pronósticos aún</p>
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

