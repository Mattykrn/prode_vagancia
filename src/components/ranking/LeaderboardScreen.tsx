// ============================================================================
// SECCIÓN 1: IMPORTACIONES Y TIPOS DE LA TABLA DE POSICIONES (GENERAL Y POR FECHA)
// ============================================================================

'use client';

import React, { useMemo, useState } from 'react';

export interface LeaderboardEntry {
  id: string;
  email: string;
  display_name: string;
  full_name: string;
  avatar_url: string | null;
  exact_hits: number;
  tendency_hits: number;
  total_points: number;
}

export interface MatchdayLeaderboardGroup {
  matchday_id: string;
  matchday_name: string;
  entries: LeaderboardEntry[];
}

interface LeaderboardScreenProps {
  embedded?: boolean;
  currentUserId: string;
  generalEntries: LeaderboardEntry[];
  matchdayGroups: MatchdayLeaderboardGroup[];
}





// ============================================================================
// SECCIÓN 2: ORDENAMIENTO DETERMINISTA (TOTAL_POINTS DESC, EXACT_HITS DESC)
// ============================================================================

export function sortLeaderboardEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.total_points !== a.total_points) {
      return b.total_points - a.total_points;
    }

    if (b.exact_hits !== a.exact_hits) {
      return b.exact_hits - a.exact_hits;
    }

    if (b.tendency_hits !== a.tendency_hits) {
      return b.tendency_hits - a.tendency_hits;
    }

    return a.display_name.localeCompare(b.display_name, 'es');
  });
}





// ============================================================================
// SECCIÓN 3: COMPONENTE DE AVATAR DE GOOGLE CON FALLBACK
// ============================================================================

function PlayerAvatar({
  name,
  avatarUrl,
  size = 'md',
}: {
  name: string;
  avatarUrl: string | null;
  size?: 'md' | 'lg';
}) {
  const dimensions = size === 'lg' ? 'h-12 w-12 text-sm' : 'h-9 w-9 text-xs';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        referrerPolicy="no-referrer"
        className={`${dimensions} shrink-0 rounded-full object-cover ring-2 ring-zinc-700`}
      />
    );
  }

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div
      className={`${dimensions} flex shrink-0 items-center justify-center rounded-full bg-zinc-800 font-bold text-zinc-200 ring-2 ring-zinc-700`}
    >
      {initials || '??'}
    </div>
  );
}





// ============================================================================
// SECCIÓN 4: PODIO VISUAL TOP 3
// ============================================================================

function PodiumBanner({ topThree }: { topThree: LeaderboardEntry[] }) {
  if (topThree.length === 0) return null;

  const medals = [
    { badge: '1°', border: 'border-amber-400/50 bg-amber-500/10', text: 'text-amber-300' },
    { badge: '2°', border: 'border-zinc-400/40 bg-zinc-800/70', text: 'text-zinc-200' },
    { badge: '3°', border: 'border-orange-500/40 bg-orange-500/10', text: 'text-orange-300' },
  ];

  return (
    <section aria-label="Podio del torneo" className="mb-5 grid grid-cols-3 gap-2">
      {topThree.map((player, index) => {
        const style = medals[index];
        return (
          <div
            key={player.id}
            className={`flex flex-col items-center rounded-2xl border p-3 text-center ${style.border}`}
          >
            <span className={`mb-1.5 text-xs font-black ${style.text}`}>{style.badge}</span>
            <PlayerAvatar name={player.display_name} avatarUrl={player.avatar_url} size="lg" />
            <p className="mt-2 w-full truncate text-xs font-bold text-white">
              {player.display_name}
            </p>
            <p className="mt-0.5 font-mono text-lg font-extrabold text-emerald-400 tabular-nums">
              {player.total_points} <span className="text-[10px] font-medium text-zinc-400">pts</span>
            </p>
            <p className="text-[10px] text-zinc-400 tabular-nums">
              {player.exact_hits} plenos
            </p>
          </div>
        );
      })}
    </section>
  );
}





// ============================================================================
// SECCIÓN 5: PANTALLA COMPLETA DE TABLA DE POSICIONES (GENERAL Y POR FECHA)
// ============================================================================

export function LeaderboardScreen({
  embedded = false,
  currentUserId,
  generalEntries,
  matchdayGroups,
}: LeaderboardScreenProps) {
  const [selectedScope, setSelectedScope] = useState<string>('GENERAL');

  const activeEntries = useMemo(() => {
    if (selectedScope === 'GENERAL') {
      return sortLeaderboardEntries(generalEntries);
    }

    const group = matchdayGroups.find((g) => g.matchday_id === selectedScope);
    return sortLeaderboardEntries(group?.entries ?? []);
  }, [selectedScope, generalEntries, matchdayGroups]);

  const topThree = activeEntries.slice(0, 3);
  const containerClass = embedded
    ? 'text-zinc-100'
    : 'mx-auto min-h-screen max-w-xl bg-zinc-950 px-4 pb-24 pt-5 text-zinc-100';

  return (
    <div className={containerClass}>
      <header className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
          Tabla de Posiciones
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          Ranking del Grupo
        </h1>
        <p className="mt-1 text-xs text-zinc-400">
          Ordenado por puntaje total y desempate automático por plenos (3 pts).
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Seleccionar ranking general o por fecha"
        className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={selectedScope === 'GENERAL'}
          onClick={() => setSelectedScope('GENERAL')}
          className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition ${
            selectedScope === 'GENERAL'
              ? 'bg-emerald-500 text-zinc-950'
              : 'border border-zinc-800 bg-zinc-900 text-zinc-300'
          }`}
        >
          Ranking General
        </button>

        {matchdayGroups.map((group) => (
          <button
            key={group.matchday_id}
            type="button"
            role="tab"
            aria-selected={selectedScope === group.matchday_id}
            onClick={() => setSelectedScope(group.matchday_id)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition ${
              selectedScope === group.matchday_id
                ? 'bg-emerald-500 text-zinc-950'
                : 'border border-zinc-800 bg-zinc-900 text-zinc-300'
            }`}
          >
            {group.matchday_name}
          </button>
        ))}
      </div>

      <PodiumBanner topThree={topThree} />

      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-xl">
        <div className="grid grid-cols-[2.25rem_1fr_3.5rem_3.5rem_4rem] items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          <span className="text-center">#</span>
          <span>Jugador</span>
          <span className="text-center text-emerald-400">3 pts</span>
          <span className="text-center text-amber-300">1 pt</span>
          <span className="text-right text-white">Total</span>
        </div>

        {activeEntries.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-400">
            Todavía no hay puntajes cargados en esta tabla.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800/80">
            {activeEntries.map((player, index) => {
              const rank = index + 1;
              const isCurrentUser = player.id === currentUserId;

              return (
                <li
                  key={player.id}
                  className={`grid grid-cols-[2.25rem_1fr_3.5rem_3.5rem_4rem] items-center gap-2 px-3 py-3 transition ${
                    isCurrentUser ? 'bg-emerald-500/10' : 'hover:bg-zinc-800/40'
                  }`}
                >
                  <span
                    className={`text-center font-mono text-sm font-extrabold tabular-nums ${
                      rank === 1
                        ? 'text-amber-300'
                        : rank === 2
                          ? 'text-zinc-200'
                          : rank === 3
                            ? 'text-orange-300'
                            : 'text-zinc-500'
                    }`}
                  >
                    {rank}
                  </span>

                  <div className="flex min-w-0 items-center gap-2.5">
                    <PlayerAvatar name={player.display_name} avatarUrl={player.avatar_url} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">
                        {player.display_name}
                        {isCurrentUser && (
                          <span className="ml-1.5 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                            Vos
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[11px] text-zinc-500">{player.full_name}</p>
                    </div>
                  </div>

                  <span className="text-center font-mono text-sm font-bold text-emerald-400 tabular-nums">
                    {player.exact_hits}
                  </span>

                  <span className="text-center font-mono text-sm font-semibold text-amber-300 tabular-nums">
                    {player.tendency_hits}
                  </span>

                  <span className="text-right font-mono text-base font-black text-white tabular-nums">
                    {player.total_points}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
