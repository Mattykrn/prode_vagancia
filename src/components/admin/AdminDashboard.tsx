// ============================================================================
// SECCIÓN 1: IMPORTACIONES E INTERFAZ DE PROPS DEL PANEL DT (ADMIN)
// ============================================================================

'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  type Matchday,
  type MatchItem,
  parseBulkMatchesInput,
} from '@/lib/prode-engine';

interface AdminDashboardProps {
  demoMode?: boolean;
  matchdays: Matchday[];
  selectedMatchday: Matchday | null;
  matches: MatchItem[];
}

// ============================================================================
// SECCIÓN 2: COMPONENTE PRINCIPAL DE GESTIÓN PARA EL ADMINISTRADOR
// ============================================================================

export default function AdminDashboard({
  demoMode = false,
  matchdays: initialMatchdays,
  selectedMatchday: initialSelectedMatchday,
  matches: initialMatches,
}: AdminDashboardProps) {
  const router = useRouter();

  const [matchdays, setMatchdays] = useState<Matchday[]>(initialMatchdays);
  const [selectedMatchdayId, setSelectedMatchdayId] = useState<string>(
    initialSelectedMatchday?.id ?? initialMatchdays[0]?.id ?? ''
  );
  const [allMatches, setAllMatches] = useState<MatchItem[]>(initialMatches);

  // Estado creación de fecha
  const [newName, setNewName] = useState('');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');

  // Estado carga masiva
  const [bulkText, setBulkText] = useState('');
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);

  // Estado resultados manuales y carga
  const [resultsInput, setResultsInput] = useState<
    Record<string, { home: string; away: string }>
  >(() => {
    const map: Record<string, { home: string; away: string }> = {};
    for (const m of initialMatches) {
      map[m.id] = {
        home: m.home_score !== null ? String(m.home_score) : '',
        away: m.away_score !== null ? String(m.away_score) : '',
      };
    }
    return map;
  });
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
  const [allResultsSaving, setAllResultsSaving] = useState(false);

  // Estado whitelist amigos
  const [friendEmail, setFriendEmail] = useState('');
  const [friendNickname, setFriendNickname] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const selectedMatchday = useMemo(
    () => matchdays.find((md) => md.id === selectedMatchdayId) ?? null,
    [matchdays, selectedMatchdayId]
  );

  const matches = useMemo(
    () =>
      allMatches
        .filter((m) => m.matchday_id === selectedMatchdayId)
        .sort((a, b) => a.order_index - b.order_index),
    [allMatches, selectedMatchdayId]
  );

  // Memo para filtrar matches con resultados cargados
  const matchesToMemo = useMemo(() => {
    return matches.filter((m) => {
      const home = resultsInput[m.id]?.home;
      const away = resultsInput[m.id]?.away;
      return home !== '' && away !== '';
    });
  }, [matches, resultsInput]);

  // ==========================================================================
  // SECCIÓN 3: CREAR FECHA Y CAMBIAR ESTADO (DRAFT -> OPEN -> CLOSED)
  // ==========================================================================

  const handleCreateMatchday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !opensAt) return;

    const opensIso = new Date(opensAt).toISOString();
    const closesIso = closesAt ? new Date(closesAt).toISOString() : null;

    if (closesIso && new Date(closesIso) <= new Date(opensIso)) {
      setStatusNotice('Error: el cierre global debe ser posterior a la apertura.');
      return;
    }

    let created: Matchday = {
      id: `matchday-${Date.now()}`,
      name: newName.trim(),
      status: 'DRAFT',
      opens_at: opensIso,
      closes_at: closesIso,
    };

    if (!demoMode) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('matchdays')
        .insert({
          name: created.name,
          status: 'DRAFT',
          opens_at: opensIso,
          closes_at: closesIso,
        })
        .select('id, name, status, opens_at, closes_at')
        .single();

      if (error || !data) {
        setStatusNotice(`Error creando fecha: ${error?.message ?? 'desconocido'}`);
        return;
      }

      created = data as Matchday;
      router.refresh();
    }

    setMatchdays((prev) => [created, ...prev]);
    setSelectedMatchdayId(created.id);
    setNewName('');
    setOpensAt('');
    setClosesAt('');
    setStatusNotice(`Fecha "${created.name}" creada en borrador. Ya podés cargar los 10 partidos.`);
  };

  const handleUpdateMatchdayStatus = async (status: Matchday['status']) => {
    if (!selectedMatchday) return;

    if (!demoMode) {
      const supabase = createClient();
      const { error } = await supabase
        .from('matchdays')
        .update({ status })
        .eq('id', selectedMatchday.id);

      if (error) {
        setStatusNotice(error.message);
        return;
      }
      router.refresh();
    }

    setMatchdays((prev) =>
      prev.map((md) => (md.id === selectedMatchday.id ? { ...md, status } : md))
    );
    setStatusNotice(`Estado de "${selectedMatchday.name}" actualizado a ${status}.`);
  };

  // ==========================================================================
  // SECCIÓN 4: CARGA MASIVA DE HASTA 10 PARTIDOS EN UN CLIC
  // ==========================================================================

  const handleBulkImport = async () => {
    if (!selectedMatchday) return;
    const remainingSlots = 10 - matches.length;

    if (remainingSlots <= 0) {
      setBulkErrors(['Esta fecha ya tiene los 10 partidos completos.']);
      return;
    }

    const nextOrder = matches.reduce((max, m) => Math.max(max, m.order_index), 0) + 1;
    const { matches: parsed, errors } = parseBulkMatchesInput(
      bulkText,
      nextOrder,
      remainingSlots
    );

    if (errors.length > 0) {
      setBulkErrors(errors);
      return;
    }

    if (parsed.length === 0) {
      setBulkErrors(['Pegá al menos 1 línea válida para importar.']);
      return;
    }

    setBulkErrors([]);
    const rowsToInsert = parsed.map((m) => ({
      ...m,
      matchday_id: selectedMatchday.id,
      status: 'SCHEDULED' as const,
    }));

    let inserted: MatchItem[] = rowsToInsert.map((row, idx) => ({
      ...row,
      id: `match-${Date.now()}-${idx}`,
      home_score: null,
      away_score: null,
    }));

    if (!demoMode) {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('matches')
        .insert(rowsToInsert)
        .select(
          'id, matchday_id, order_index, competition_name, home_team, away_team, odd_home, odd_draw, odd_away, kickoff_time, status, home_score, away_score'
        );

      if (error || !data) {
        setBulkErrors([error?.message ?? 'Error al importar partidos.']);
        return;
      }

      inserted = data as MatchItem[];
      router.refresh();
    }

    setAllMatches((prev) => [...prev, ...inserted]);
    setBulkText('');
    setStatusNotice(`¡Se cargaron ${inserted.length} partidos correctamente!`);
  };

  // ==========================================================================
  // SECCIÓN 5: GUARDAR RESULTADO FINAL Y DISPARAR RECÁLCULO AUTOMÁTICO DE PUNTOS
  // ==========================================================================

  const handleSaveMatchResult = async (matchId: string) => {
    const entry = resultsInput[matchId];
    if (!entry || entry.home === '' || entry.away === '') return;

    const homeScore = Number.parseInt(entry.home, 10);
    const awayScore = Number.parseInt(entry.away, 10);

    if (
      !Number.isInteger(homeScore) ||
      !Number.isInteger(awayScore) ||
      homeScore < 0 ||
      awayScore < 0
    ) {
      setStatusNotice('Ingresá goles enteros mayores o iguales a 0.');
      return;
    }

    setSavingMatchId(matchId);

    if (!demoMode) {
      const supabase = createClient();
      const { error } = await supabase.rpc('set_match_result_and_recalculate', {
        p_match_id: matchId,
        p_home_score: homeScore,
        p_away_score: awayScore,
      });

      setSavingMatchId(null);

      if (error) {
        setStatusNotice(`Error al calcular puntos: ${error.message}`);
        return;
      }
      router.refresh();
    } else {
      setSavingMatchId(null);
    }

    // Force refresh to ensure leaderboard and points are updated
    // after the match result is saved. The supabase trigger
    // trigger_recalculate_on_match_update should update predictions.points_earned
    // and the leaderboard tables, but we refresh to be certain.
    await new Promise(resolve => setTimeout(resolve, 500));

    setAllMatches((prev) =>
      prev.map((m) =>
        m.id === matchId
          ? { ...m, status: 'FINISHED', home_score: homeScore, away_score: awayScore }
          : m
      )
    );
    setStatusNotice(`Resultado (${homeScore}-${awayScore}) guardado y tabla recalculada.`);
  };

  const [refreshingLeaderboard, setRefreshingLeaderboard] = useState(false);

  const forceRecalculateLeaderboard = async () => {
    setRefreshingLeaderboard(true);
    setStatusNotice('Recalculando tabla de posiciones y puntos...');

    if (!demoMode) {
      const supabase = createClient();
      // Run the SQL function to recalculate all leaderboard points
      const { error } = await supabase.rpc('recalculate_match_points', {
        p_match_id: null, // null means all matches
      });

      if (error) {
        setStatusNotice(`Error al recalcular tabla: ${error.message}`);
      } else {
        setStatusNotice(`Tabla de posiciones recalculada correctamente.`);
      }
    }

    setRefreshingLeaderboard(false);
    router.refresh();
  };

  const handleSaveAllResults = async () => {
    setAllResultsSaving(true);
    setStatusNotice('Guardando todos los resultados...');

    if (matchesToMemo.length === 0) {
      setStatusNotice('No hay resultados cargados para guardar.');
      setAllResultsSaving(false);
      return;
    }

    if (!demoMode) {
      const supabase = createClient();
      const promises = matchesToMemo.map((m) => {
        const homeScore = Number.parseInt(resultsInput[m.id]?.home ?? '0', 10);
        const awayScore = Number.parseInt(resultsInput[m.id]?.away ?? '0', 10);
        return supabase.rpc('set_match_result_and_recalculate', {
          p_match_id: m.id,
          p_home_score: homeScore,
          p_away_score: awayScore,
        });
      });

      const results = await Promise.allSettled(promises);
      const errors = results.filter(
        (r) => r.status === 'rejected' || (r.status === 'fulfilled' && 'error' in r.value && r.value.error != null)
      );

      setAllResultsSaving(false);

      if (errors.length > 0) {
        const errorMsg = errors
          .map((e) => (e.status === 'rejected' ? e.reason?.message || 'Error desconocido' : e.value?.error?.message || 'Error desconocido'))
          .filter(Boolean)
          .join('. ');
        setStatusNotice(`Errores al guardar algunos resultados: ${errorMsg}`);
        return;
      }
    }

    setAllMatches(
      allMatches.map((m) =>
        matchesToMemo.some((ms) => ms.id === m.id)
          ? {
              ...m,
              status: 'FINISHED',
              home_score: Number(resultsInput[m.id]?.home ?? m.home_score ?? 0),
              away_score: Number(resultsInput[m.id]?.away ?? m.away_score ?? 0),
            }
          : m
      )
    );

    setStatusNotice(
      `Se guardaron ${matchesToMemo.length} resultado(s) y la tabla fue recalculada.`
    );
    router.refresh();
    setAllResultsSaving(false);
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendEmail.trim() || !friendNickname.trim()) return;

    if (!demoMode) {
      const supabase = createClient();
      const { error } = await supabase.from('allowed_users').upsert({
        email: friendEmail.trim().toLowerCase(),
        nickname: friendNickname.trim(),
        is_admin: false,
      });

      if (error) {
        setStatusNotice(error.message);
        return;
      }
      router.refresh();
    }

    setStatusNotice(`Amigo ${friendNickname.trim()} habilitado para entrar con Google.`);
    setFriendEmail('');
    setFriendNickname('');
  };

  // ==========================================================================
  // SECCIÓN 6: INTERFAZ DE CONTROL DEL DT (ESTÉTICA CANCHA + TIZA)
  // ==========================================================================

  return (
    <div className="mx-auto max-w-lg space-y-5 px-3 pb-24 pt-4">
      <div className="flex items-center justify-between rounded-2xl bg-[#0d2117] p-4 chalk-border">
        <div>
          <h1 className="text-lg font-black text-amber-400">📋 VESTUARIO DT (ADMIN)</h1>
          <p className="text-xs text-slate-400">Control total de fechas, partidos y puntos</p>
        </div>

        <Link href="/" className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white">
          ← Volver a Cancha
        </Link>
      </div>

      {statusNotice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/20 p-3 text-xs font-bold text-emerald-200"
        >
          {statusNotice}
        </div>
      )}

      {/* SELECTOR DE FECHA ACTIVA EN EL PANEL */}
      {matchdays.length > 0 && (
        <div className="space-y-2 rounded-2xl bg-[#0d2117] p-4 chalk-border">
          <label
            htmlFor="admin-matchday-select"
            className="block text-[10px] font-black uppercase tracking-wider text-slate-400"
          >
            Fecha en edición
          </label>
          <select
            id="admin-matchday-select"
            value={selectedMatchdayId}
            onChange={(e) => {
              setSelectedMatchdayId(e.target.value);
              setBulkErrors([]);
            }}
            className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-xs font-bold text-white"
          >
            {matchdays.map((md) => (
              <option key={md.id} value={md.id}>
                [{md.status}] {md.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* CREAR NUEVA FECHA */}
      <form
        onSubmit={handleCreateMatchday}
        className="space-y-3 rounded-2xl bg-[#0d2117] p-4 chalk-border"
      >
        <h2 className="text-xs font-black uppercase tracking-wider text-emerald-400">
          1. Crear Nueva Fecha
        </h2>
        <input
          type="text"
          placeholder="Ej: Fecha 1 - Champions y Ascenso"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-xs text-white"
          required
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[10px] uppercase text-slate-400">Abre el:</label>
            <input
              type="datetime-local"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-2.5 py-2 text-xs text-white"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase text-slate-400">
              Cierre global (opc.):
            </label>
            <input
              type="datetime-local"
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-2.5 py-2 text-xs text-white"
            />
          </div>
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-emerald-500 py-2.5 text-xs font-black uppercase text-slate-950"
        >
          Crear Fecha
        </button>
      </form>

      {/* CARGA MASIVA DE LOS 10 PARTIDOS */}
      {selectedMatchday && (
        <div className="space-y-3 rounded-2xl bg-[#0d2117] p-4 chalk-border">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-black uppercase tracking-wider text-emerald-400">
              2. Cargar Partidos ({matches.length}/10)
            </h2>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => handleUpdateMatchdayStatus('OPEN')}
                className="rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-black text-slate-950"
              >
                Abrir Fecha
              </button>
              <button
                type="button"
                onClick={() => handleUpdateMatchdayStatus('CLOSED')}
                className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-[11px] font-bold text-rose-300"
              >
                Cerrar
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            Pegá hasta 10 líneas con formato{' '}
            <code className="text-amber-300">
              Liga | Local vs Visitante | YYYY-MM-DD HH:mm | 2.30 - 3.10 - 2.95
            </code>
          </p>

          <textarea
            rows={7}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={`Champions | Real Madrid vs Arsenal | 2026-11-28 17:00 | 2.15 - 3.40 - 3.30\nPrimera Nacional | Colon vs Moron | 2026-11-29 19:10 | 2.05 - 3.00 - 3.60`}
            className="w-full rounded-xl border border-white/10 bg-black/50 p-3 font-mono text-xs text-white"
          />

          {bulkErrors.length > 0 && (
            <ul className="space-y-1 rounded-xl bg-rose-500/15 p-2.5 text-[11px] text-rose-300">
              {bulkErrors.map((err, i) => (
                <li key={i}>⚠️ {err}</li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={handleBulkImport}
            className="w-full rounded-xl bg-amber-500 py-2.5 text-xs font-black uppercase text-slate-950"
          >
            Importar Partidos a la Boleta
          </button>
        </div>
      )}

      {/* CARGA DE RESULTADOS Y RECÁLCULO */}
      {matches.length > 0 && (
        <div className="space-y-2.5 rounded-2xl bg-[#0d2117] p-4 chalk-border">
          <h2 className="text-xs font-black uppercase tracking-wider text-emerald-400">
            3. Cargar Resultados Finales
          </h2>

          {matches.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/40 p-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">
                  {m.home_team} vs {m.away_team}
                </p>
                <span className="text-[10px] text-slate-400">
                  #{m.order_index} · {m.competition_name} · {m.status}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  value={resultsInput[m.id]?.home ?? ''}
                  onChange={(e) =>
                    setResultsInput((prev) => ({
                      ...prev,
                      [m.id]: { home: e.target.value, away: prev[m.id]?.away ?? '' },
                    }))
                  }
                  className="h-8 w-10 rounded border border-white/15 bg-slate-900 text-center text-xs font-black text-white"
                />
                <span className="text-xs text-slate-500">-</span>
                <input
                  type="number"
                  min={0}
                  value={resultsInput[m.id]?.away ?? ''}
                  onChange={(e) =>
                    setResultsInput((prev) => ({
                      ...prev,
                      [m.id]: { home: prev[m.id]?.home ?? '', away: e.target.value },
                    }))
                  }
                  className="h-8 w-10 rounded border border-white/15 bg-slate-900 text-center text-xs font-black text-white"
                />
                <button
                  type="button"
                  disabled={savingMatchId === m.id}
                  onClick={() => handleSaveMatchResult(m.id)}
                  className="ml-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-[11px] font-black text-slate-950 disabled:opacity-50"
                >
                  {savingMatchId === m.id ? '...' : 'OK'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

{matchesToMemo.length > 0 && (
        <div>
          <button
            onClick={handleSaveAllResults}
            disabled={allResultsSaving}
            className="w-full rounded-xl bg-emerald-500 py-2.5 text-xs font-black uppercase text-slate-950 transition hover:bg-emerald-400 active:scale-[0.99] disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {allResultsSaving ? 'Guardando todos los resultados...' : `Guardar Todos los Resultados Cargados (${matchesToMemo.length})`}
          </button>
        </div>
      )}
      {matchesToMemo.length > 0 && (
        <div>
          <button
            onClick={forceRecalculateLeaderboard}
            disabled={refreshingLeaderboard}
            className="w-full rounded-xl bg-indigo-500 py-2.5 text-xs font-black uppercase text-slate-950 transition hover:bg-indigo-400 active:scale-[0.99] disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {refreshingLeaderboard ? 'Recalculando...' : 'Recalcular tabla y puntos'}
          </button>
        </div>
      )}
      {/* AGREGAR AMIGOS PERMITIDOS */}
      <form
        onSubmit={handleAddFriend}
        className="space-y-2.5 rounded-2xl bg-[#0d2117] p-4 chalk-border"
      >
        <h2 className="text-xs font-black uppercase tracking-wider text-emerald-400">
          4. Habilitar Gmail de Amigo
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="email"
            placeholder="amigo@gmail.com"
            value={friendEmail}
            onChange={(e) => setFriendEmail(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
            required
          />
          <input
            type="text"
            placeholder="Apodo (ej: Gus)"
            value={friendNickname}
            onChange={(e) => setFriendNickname(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-white/10 py-2 text-xs font-bold text-white hover:bg-white/20"
        >
          + Agregar a la Lista Blanca
        </button>
      </form>
    </div>
  );
}