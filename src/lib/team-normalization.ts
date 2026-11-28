// ============================================================================
// MÓDULO DE NORMALIZACIÓN SEGURA DE NOMBRES DE EQUIPOS
// ============================================================================

// Diccionario de equivalencias y aliases para nombres de equipos.
// Las claves son las formas "canónicas" normalizadas y los valores son
// arrays de variantes que deben mapearse a esa clave.
const TEAM_ALIASES: Record<string, string[]> = {
  // Argentina
  riverplate: ['river plate', 'river', 'river Plate'],
  bocajuniors: ['boca juniors', 'boca', 'Boca Juniors', 'Boca'],
  independiente: ['independiente', 'Racing Club', 'Racing'],
  racing: ['racing club', 'Racing Club'],
  reunion: ['reunion island', 'Reunion Island'],
  // Europe
  realmadrid: ['real madrid', 'Real Madrid', 'Real'],
  barcelona: ['barcelona', 'FC Barcelona', 'Barcelona'],
  atletemadrid: ['atletico de madrid', 'atletico de madrid', 'Atlético de Madrid', 'Atleti'],
  arsenal: ['arsenal', 'Arsenal'],
  chelsea: ['chelsea', 'Chelsea'],
  liverpool: ['liverpool', 'Liverpool'],
  manchesterunited: ['manchester united', 'Manchester United', 'Man Utd'],
  mancity: ['manchester city', 'Manchester City', 'Man City'],
  tottenham: ['tottenham hotspur', 'Tottenham Hotspur', 'Spurs'],
  // Brasil
  palmeiras: ['palmeiras', 'Palmeiras'],
  santos: ['santos', 'Santos'],
  corinthians: ['corinthians', 'Corinthians'],
  grêmio: ['grêmio', 'Gremio', 'Gremio'],
  flamengo: ['flamengo', 'Flamengo'],
  // Italia
  juventus: ['juventus', 'Juventus'],
  milan: ['milan', 'Milan', 'AC Milan', 'Inter Milan'],
  // España
  atleticobilbao: ['athletic bilbao', 'Athletic Bilbao', 'Athletic'],
  valencia: ['valencia', 'Valencia'],
  // Francia
  paris: ['paris saint-germain', 'PSG', 'Paris Saint-Germain'],
  // England lower divisions
  everton: ['everton', 'Everton'],
  // Portugal
  sportinguista: ['sporting lisboa', 'Sporting Lisbon', 'Sporting'],
};

// Normaliza un nombre de equipo: minúsculas, sin tildes, sin signos especiales,
// separación por espacios simples.
export function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/[^a-z0-9\s]/g, '') // quita signos no alfanuméricos (excepto espacios)
    .replace(/\s+/g, ' ') // normaliza espacios múltiplos
    .trim();
}

// Busca el nombre canónico de un equipo dado una variante.
// Retorna el nombre canónico si encuentra coincidencia, o el nombre normalizado
// si no hay alias, o undefined si el string está vacío.
export function getCanonicalTeamName(name: string): string | undefined {
  if (!name || !name.trim()) return undefined;

  const normalized = normalizeName(name);

  // Primero buscamos en los valores (variantes) del diccionario
  for (const [canonical, variants] of Object.entries(TEAM_ALIASES)) {
    if (variants.includes(normalized)) {
      return canonical;
    }
    // También buscamos si el normalized name es un substring de alguna variante
    // o si alguna variante es substring del normalized
    for (const variant of variants) {
      if (normalizeName(variant) === normalized) {
        return canonical;
      }
    }
  }

  // Si no encontró en el diccionario, retornamos el nombre normalizado
  // para que no se pierda, pero el usuario deberá revisarlo después.
  return normalized;
}

// Obtiene todas las variantes conocidas para un nombre canónico.
export function getTeamVariants(canonical: string): string[] {
  return TEAM_ALIASES[canonical] || [];
}

// Verifica si un nombre es un alias conocido de un equipo canónico.
export function isKnownTeamAlias(name: string): boolean {
  return getCanonicalTeamName(name) !== undefined;
}
// ============================================================================
// SECCIÓN EXTRA: LÓGICA DE SEMANA Y FALLBACKS
// ============================================================================

// Día de la semana (0 = Domingo, 1 = Lunes, ..., 6 = Sábado)
function getDayOfWeek(date: Date): number {
  return date.getDay();
}

// Nombre del día en español
function getDayNameEs(date: Date): string {
  const days: string[] = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
  ];
  return days[getDayOfWeek(date)];
}

// Regla de prioridad según el día de la semana
// Retorna un objeto con la prioridad y el tipo de competición
export function getWeeklyMatchPriority(date: Date): {
  priority: 'rest' | 'european_cups' | 'league';
  competitionType?: string;
} {
  const day = getDayOfWeek(date);

  // Lunes: día de descanso
  if (day === 1) {
    return { priority: 'rest' };
  }

  // Martes a jueves (2, 3, 4): copas europeas
  if (day >= 2 && day <= 4) {
    return { priority: 'european_cups', competitionType: 'Champions League, Europa League, Conference League' };
  }

  // Viernes a domingo (5, 6, 0): liga
  if (day >= 5 || day === 0) {
    return { priority: 'league', competitionType: 'Liga' };
  }

  return { priority: 'league' };
}

// Cadena de respaldo para cuando no hay partidos disponibles
// 1° respaldo: selecciones juveniles
// 2° respaldo: NBA
export function getFallbackMatches(priority: 'sub-20' | 'nba'): {
  matches: Array<{ competition_name: string; home_team: string; away_team: string; kickoff_time: string }>;
  reason: string;
} {
  if (priority === 'sub-20') {
    return {
      matches: [
        {
          competition_name: 'Sudamericano Sub-20',
          home_team: 'Selección Argentina Sub-20',
          away_team: 'Selección Brasil Sub-20',
          kickoff_time: '2025-01-15T20:00:00-03:00',
        },
        {
          competition_name: 'Clasificación Sudamericana Sub-20',
          home_team: 'Selección Uruguay Sub-20',
          away_team: 'Selección Colombia Sub-20',
          kickoff_time: '2025-01-16T18:00:00-03:00',
        },
        {
          competition_name: 'Torneio Internacional Sub-20',
          home_team: 'Selección Paraguay Sub-20',
          away_team: 'Selección Perú Sub-20',
          kickoff_time: '2025-01-17T20:00:00-03:00',
        },
        {
          competition_name: 'Amistoso Sudamericano Sub-20',
          home_team: 'Selección Ecuador Sub-20',
          away_team: 'Selección Venezuela Sub-20',
          kickoff_time: '2025-01-18T16:00:00-03:00',
        },
        {
          competition_name: 'Copa Juvenil Norteamericana',
          home_team: 'Selección México Sub-20',
          away_team: 'Selección Estados Unidos Sub-20',
          kickoff_time: '2025-01-19T17:00:00-03:00',
        },
      ],
      reason: '1° respaldo: selecciones juveniles (Sub-20)'
    };
  }

  if (priority === 'nba') {
    return {
      matches: [
        {
          competition_name: 'NBA',
          home_team: 'Los Angeles Lakers',
          away_team: 'Boston Celtics',
          kickoff_time: '2025-01-15T20:30:00-03:00',
        },
        {
          competition_name: 'NBA',
          home_team: 'Golden State Warriors',
          away_team: 'Miami Heat',
          kickoff_time: '2025-01-16T21:00:00-03:00',
        },
        {
          competition_name: 'NBA',
          home_team: 'Chicago Bulls',
          away_team: 'Denver Nuggets',
          kickoff_time: '2025-01-17T21:30:00-03:00',
        },
        {
          competition_name: 'NBA',
          home_team: 'San Antonio Spurs',
          away_team: 'Philadelphia 76ers',
          kickoff_time: '2025-01-18T20:00:00-03:00',
        },
        {
          competition_name: 'NBA',
          home_team: 'Milwaukee Bucks',
          away_team: 'Toronto Raptors',
          kickoff_time: '2025-01-20T21:00:00-03:00',
        },
      ],
      reason: '2° respaldo: partidos de NBA'
    };
  }

  return { matches: [], reason: 'Sin fallback disponible' };
}

// ============================================================================
// SECCIÓN EXTRA: CONFIGURACIÓN DE GRÍLLA DE 15 PARTIDOS DESDE FLASHSCORE
// ============================================================================

// Configuración de la grilla de 15 partidos distribuidos por origen competitivo:
// - 3 de ligas europeas
// - 3 de Liga Argentina
// - 2 de categorías de ascenso de Argentina
// - 2 random de categorías de ascenso de Europa
// - 5 del resto de América

// Datos de ejemplo de la grilla de 15 partidos (formato Flashscore)
// Estos datos usan nombres de equipos que luego se normalizan con el módulo
export const FLASHSCORE_GRID_15: Array<{
  competition_name: string;
  home_team_raw: string;
  away_team_raw: string;
  kickoff_time: string;
}> = [
  // 3 de ligas europeas
  {
    competition_name: 'Premier League',
    home_team_raw: 'Arsenal',
    away_team_raw: 'Manchester City',
    kickoff_time: '2026-11-28T20:00:00-03:00',
  },
  {
    competition_name: 'LaLiga',
    home_team_raw: 'Real Madrid',
    away_team_raw: 'Atlético de Madrid',
    kickoff_time: '2026-11-29T13:30:00-03:00',
  },
  {
    competition_name: 'Serie A',
    home_team_raw: 'Juventus',
    away_team_raw: 'Inter de Milán',
    kickoff_time: '2026-11-29T16:45:00-03:00',
  },
  // 3 de Liga Argentina
  {
    competition_name: 'Liga Profesional',
    home_team_raw: 'River Plate',
    away_team_raw: 'Boca Juniors',
    kickoff_time: '2026-11-28T17:00:00-03:00',
  },
  {
    competition_name: 'Liga Profesional',
    home_team_raw: 'Racing Club',
    away_team_raw: 'Independiente',
    kickoff_time: '2026-11-28T20:00:00-03:00',
  },
  {
    competition_name: 'Liga Profesional',
    home_team_raw: 'Racing',
    away_team_raw: 'Racing Club',
    kickoff_time: '2026-11-27T21:10:00-03:00',
  },
  // 2 de categorías de ascenso de Argentina
  {
    competition_name: 'Primera Nacional',
    home_team_raw: 'Colón',
    away_team_raw: 'Racing Club',
    kickoff_time: '2026-11-27T21:10:00-03:00',
  },
  {
    competition_name: 'Primera Nacional',
    home_team_raw: 'Defensores de Belgrano',
    away_team_raw: 'Acassuso',
    kickoff_time: '2026-11-28T19:00:00-03:00',
  },
  // 2 random de categorías de ascenso de Europa
  {
    competition_name: 'Championship',
    home_team_raw: 'Leeds United',
    away_team_raw: 'Sheffield United',
    kickoff_time: '2026-11-28T16:45:00-03:00',
  },
  {
    competition_name: 'Eredivisie',
    home_team_raw: 'Ajax',
    away_team_raw: 'Feyenoord',
    kickoff_time: '2026-11-29T14:00:00-03:00',
  },
  // 5 del resto de América
  {
    competition_name: 'Brasileirão',
    home_team_raw: 'Palmeiras',
    away_team_raw: 'Santos',
    kickoff_time: '2026-11-29T18:30:00-03:00',
  },
  {
    competition_name: 'Brasileirão',
    home_team_raw: 'Flamengo',
    away_team_raw: 'Grêmio',
    kickoff_time: '2026-11-29T20:00:00-03:00',
  },
  {
    competition_name: 'Liga MX',
    home_team_raw: 'América',
    away_team_raw: 'Chivas',
    kickoff_time: '2026-11-30T17:00:00-03:00',
  },
  {
    competition_name: 'Liga MX',
    home_team_raw: 'Cruz Azul',
    away_team_raw: 'Pumas',
    kickoff_time: '2026-11-30T19:30:00-03:00',
  },
  {
    competition_name: 'Liga Colombiana',
    home_team_raw: 'Atlético Nacional',
    away_team_raw: 'Deportes Tolima',
    kickoff_time: '2026-11-30T20:00:00-03:00',
  },
];

// Normaliza los nombres de equipos de la grilla y retorna los nombres canonicalizados
export function normalizeFlashscoreGrid(grid: typeof FLASHSCORE_GRID_15): Array<{
  competition_name: string;
  home_team: string; // canonicalizado
  away_team: string; // canonicalizado
  kickoff_time: string;
}> {
  return grid.map((match) => ({
    competition_name: match.competition_name,
    home_team: getCanonicalTeamName(match.home_team_raw) || match.home_team_raw,
    away_team: getCanonicalTeamName(match.away_team_raw) || match.away_team_raw,
    kickoff_time: match.kickoff_time,
  }));
}

// Obtiene la grilla de 15 partidos ya normalizada
export function getNormalizedGrid(): Array<{
  competition_name: string;
  home_team: string;
  away_team: string;
  kickoff_time: string;
}> {
  return normalizeFlashscoreGrid(FLASHSCORE_GRID_15);
}

// ============================================================================
// SECCIÓN EXTRA: CIERRE DE APUESTAS Y HORA LÍMITE
// ============================================================================

// Calcula la hora límite de apuestas como el partido con kickoff más temprano
// de la grilla de 15 partidos normalizada
export function getBettingCutoffTime(grid: Array<{
  kickoff_time: string;
}>): Date | null {
  if (!grid || grid.length === 0) return null;

  // Normalizar todos los kickoff_time a fechas consistentes en UTC.
  // Si el string no tiene offset de zona horaria, asumimos America/Argentina/Buenos_Aires (-03:00).
  const dates = grid.map((match) => {
    const ks = match.kickoff_time;
    // Si no tiene offset (ej. "2026-11-28T20:00:00"), agregamos -03:00
    const hasOffset = /-[0-9]{2}:[0-9]{2}$/.test(ks) || /\+[0-9]{2}:[0-9]{2}$/.test(ks);
    if (hasOffset) {
      return new Date(ks);
    }
    // Agregar offset -03:00 para horarios de Argentina
    return new Date(ks + "-03:00");
  });
  const validDates = dates.filter((d) => !isNaN(d.getTime()));

  if (validDates.length === 0) return null;

  // Ordenar por fecha (getTime() siempre devuelve UTC) y obtener la más temprana
  const sorted = [...validDates].sort((a, b) => a.getTime() - b.getTime());
  return sorted[0];
}

// Calcula el tiempo restante hasta el cierre de apuestas
export function getTimeUntilCutoff(grid: Array<{
  kickoff_time: string;
}>): {
  hours: number;
  minutes: number;
  seconds: number;
  hasPassed: boolean;
} {
  const cutoff = getBettingCutoffTime(grid);
  if (!cutoff) return { hours: 0, minutes: 0, seconds: 0, hasPassed: false };

  // Usar UTC de forma explícita para el "now" para consistencia en todos los entornos
  const now = new Date();
  const timeUntil = cutoff.getTime() - now.getTime();
  const hasPassed = now.getTime() >= cutoff.getTime();

  const hours = Math.max(0, Math.floor(timeUntil / (1000 * 60 * 60)));
  const minutes = Math.max(0, Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60)));
  const seconds = Math.max(0, Math.floor((timeUntil % (1000 * 60)) / 1000));

  return { hours, minutes, seconds, hasPassed };
}

// Determina si las apuestas están abiertas o cerradas
export function areBetsOpen(grid: Array<{
  kickoff_time: string;
}>): boolean {
  return !getTimeUntilCutoff(grid).hasPassed;
}
