// ============================================================================
// SECCIÓN 1: TIPOS Y CONSTANTES DEL PARSER DE CARGA MASIVA (10 PARTIDOS)
// ============================================================================

export const MAX_MATCHES_PER_MATCHDAY = 10;

export interface ParsedBulkMatch {
  order_index: number;
  competition_name: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
  odd_home: number | null;
  odd_draw: number | null;
  odd_away: number | null;
}

export interface BulkParseError {
  lineNumber: number;
  rawLine: string;
  message: string;
}

export interface BulkParseResult {
  matches: ParsedBulkMatch[];
  errors: BulkParseError[];
}

export interface BulkParseOptions {
  startOrderIndex?: number;
  maxMatches?: number;
}





// ============================================================================
// SECCIÓN 2: PARSEO DE EQUIPOS, FECHA/HORA Y CUOTAS OPCIONALES 1X2
// ============================================================================

function parseTeams(segment: string): { home: string; away: string } | null {
  const parts = segment.split(/\s+vs\.?\s+/i);

  if (parts.length !== 2) {
    return null;
  }

  const home = parts[0].trim();
  const away = parts[1].trim();

  if (!home || !away || home.toLowerCase() === away.toLowerCase()) {
    return null;
  }

  return { home, away };
}

function parseKickoffIso(segment: string): string | null {
  const trimmed = segment.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);

  if (match) {
    const [, year, month, day, hour, minute, second = '00'] = match;
    const localDate = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );

    if (
      localDate.getFullYear() !== Number(year) ||
      localDate.getMonth() !== Number(month) - 1 ||
      localDate.getDate() !== Number(day) ||
      localDate.getHours() !== Number(hour) ||
      localDate.getMinutes() !== Number(minute)
    ) {
      return null;
    }

    return localDate.toISOString();
  }

  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback.toISOString();
}

function parseOptionalOdds(
  segment: string | undefined
): { odd_home: number | null; odd_draw: number | null; odd_away: number | null } | null {
  if (!segment || segment.trim() === '') {
    return { odd_home: null, odd_draw: null, odd_away: null };
  }

  const normalized = segment.replace(/,/g, '.').trim();
  const rawValues = normalized
    .split(/\s*[-/]\s*|\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (rawValues.length !== 3) {
    return null;
  }

  const [home, draw, away] = rawValues.map((token) => Number(token));

  if (
    !Number.isFinite(home) ||
    !Number.isFinite(draw) ||
    !Number.isFinite(away) ||
    home <= 1 ||
    draw <= 1 ||
    away <= 1
  ) {
    return null;
  }

  return {
    odd_home: Number(home.toFixed(2)),
    odd_draw: Number(draw.toFixed(2)),
    odd_away: Number(away.toFixed(2)),
  };
}





// ============================================================================
// SECCIÓN 3: FUNCIÓN PRINCIPAL parseBulkMatchesText (CONVALIDACIÓN LÍNEA POR LÍNEA)
// ============================================================================

export function parseBulkMatchesText(
  rawText: string,
  options: BulkParseOptions = {}
): BulkParseResult {
  const startOrderIndex = options.startOrderIndex ?? 1;
  const maxMatches = options.maxMatches ?? MAX_MATCHES_PER_MATCHDAY;

  const lines = rawText.split(/\r?\n/);
  const matches: ParsedBulkMatch[] = [];
  const errors: BulkParseError[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    const lineNumber = idx + 1;

    if (!trimmed) {
      return;
    }

    if (matches.length >= maxMatches) {
      errors.push({
        lineNumber,
        rawLine: trimmed,
        message: `Se excede el cupo máximo disponible (${maxMatches} partidos).`,
      });
      return;
    }

    const columns = trimmed.split('|').map((col) => col.trim());

    if (columns.length < 3 || columns.length > 4) {
      errors.push({
        lineNumber,
        rawLine: trimmed,
        message:
          'Formato esperado: Liga | Local vs Visitante | YYYY-MM-DD HH:mm | 2.30 - 3.10 - 2.95 (cuotas opcionales).',
      });
      return;
    }

    const [competition, teamsCol, dateCol, oddsCol] = columns;

    if (!competition) {
      errors.push({
        lineNumber,
        rawLine: trimmed,
        message: 'Falta el nombre de la liga o competición.',
      });
      return;
    }

    const teams = parseTeams(teamsCol);
    if (!teams) {
      errors.push({
        lineNumber,
        rawLine: trimmed,
        message: 'El cruce debe escribirse como "Equipo Local vs Equipo Visitante".',
      });
      return;
    }

    const kickoffIso = parseKickoffIso(dateCol);
    if (!kickoffIso) {
      errors.push({
        lineNumber,
        rawLine: trimmed,
        message: 'Fecha/hora inválida. Usá el formato YYYY-MM-DD HH:mm (ej. 2026-11-28 21:00).',
      });
      return;
    }

    const odds = parseOptionalOdds(oddsCol);
    if (!odds) {
      errors.push({
        lineNumber,
        rawLine: trimmed,
        message: 'Cuotas inválidas. Usá 3 números mayores a 1.00 separados por guión (ej. 2.30 - 3.10 - 2.95).',
      });
      return;
    }

    matches.push({
      order_index: startOrderIndex + matches.length,
      competition_name: competition,
      home_team: teams.home,
      away_team: teams.away,
      kickoff_time: kickoffIso,
      odd_home: odds.odd_home,
      odd_draw: odds.odd_draw,
      odd_away: odds.odd_away,
    });
  });

  return { matches, errors };
}





// ============================================================================
// SECCIÓN 4: PLANTILLA DE EJEMPLO (10 LÍNEAS LISTAS PARA PEGAR EN /admin)
// ============================================================================

export function buildBulkExampleText(referenceDate: Date = new Date()): string {
  const day = (offsetDays: number) => {
    const d = new Date(referenceDate.getTime() + offsetDays * 24 * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  return [
    `Liga Profesional | River Plate vs Boca Juniors | ${day(2)} 17:00 | 2.40 - 3.10 - 2.95`,
    `Primera Nacional | San Martín (T) vs Quilmes | ${day(2)} 19:15 | 2.55 - 2.85 - 2.80`,
    `Primera Nacional | Colón vs Nueva Chicago | ${day(2)} 21:10 | 2.65 - 2.90 - 2.70`,
    `Premier League | Arsenal vs Liverpool | ${day(3)} 13:30 | 2.60 - 3.20 - 2.65`,
    `LaLiga | Atlético Madrid vs Villarreal | ${day(3)} 16:00 | 2.15 - 3.35 - 3.30`,
    `Serie A | AC Milan vs Juventus | ${day(3)} 16:45 | 2.50 - 3.10 - 2.80`,
    `Champions League | Bayern Múnich vs PSG | ${day(4)} 17:00 | 2.20 - 3.55 - 3.05`,
    `EFL Championship | Leeds United vs Sheffield United | ${day(4)} 16:45 | 2.45 - 3.15 - 2.85`,
    `Brasileirão | Flamengo vs Palmeiras | ${day(4)} 20:00 | 2.55 - 3.05 - 2.75`,
    `Liga Bielorrusia | Dinamo Minsk vs BATE Borisov | ${day(5)} 14:00 | 2.60 - 2.95 - 2.75`,
  ].join('\n');
}

