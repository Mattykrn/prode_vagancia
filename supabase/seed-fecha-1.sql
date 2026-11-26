-- ============================================================================
-- SECCIÓN 1: REINICIO LIMPIO DEL TORNEO (PUNTOS EN 0 Y FECHAS PREVIAS BORRADAS)
-- ============================================================================

BEGIN;

DELETE FROM public.predictions;
DELETE FROM public.matches;
DELETE FROM public.matchdays;

UPDATE public.profiles
SET total_points = 0, exact_hits = 0, updated_at = NOW();





-- ============================================================================
-- SECCIÓN 2: CREACIÓN DE FECHA 1 (ABRE HOY 25/11/2026 - CIERRA 02/12/2026)
-- ============================================================================

WITH nueva_fecha AS (
  INSERT INTO public.matchdays (name, status, opens_at, closes_at)
  VALUES (
    'Fecha 1 · 25/11 al 02/12',
    'OPEN',
    '2026-11-25 20:45:00-03'::timestamptz,
    '2026-12-02 23:59:00-03'::timestamptz
  )
  RETURNING id
)
INSERT INTO public.matches (
  matchday_id,
  order_index,
  competition_name,
  home_team,
  away_team,
  kickoff_time,
  odd_home,
  odd_draw,
  odd_away,
  status
)
SELECT
  nf.id,
  v.order_index,
  v.competition_name,
  v.home_team,
  v.away_team,
  v.kickoff_time::timestamptz,
  v.odd_home,
  v.odd_draw,
  v.odd_away,
  'SCHEDULED'::public.match_status
FROM nueva_fecha nf
CROSS JOIN (
  VALUES
    (1,  'Europa League',        'Real Sociedad',      'Ajax',            '2026-11-28 17:00:00-03', 2.25, 3.30, 3.15),
    (2,  'Premier League',       'Brighton',           'Fulham',          '2026-11-28 12:00:00-03', 2.15, 3.50, 3.25),
    (3,  'Serie A',              'Fiorentina',         'Bologna',         '2026-11-29 14:00:00-03', 2.35, 3.20, 3.10),
    (4,  'Liga Profesional',     'Huracan',            'Velez',           '2026-11-28 21:15:00-03', 2.60, 2.95, 2.90),
    (5,  'Brasileirao',          'Internacional',      'Botafogo',        '2026-11-29 18:30:00-03', 2.40, 3.15, 3.00),
    (6,  'Copa Libertadores',    'Atletico Mineiro',   'Racing Club',     '2026-11-29 21:00:00-03', 2.30, 3.10, 3.20),
    (7,  'Primera Nacional',     'Colon',              'Deportivo Moron', '2026-11-28 19:10:00-03', 2.10, 3.00, 3.60),
    (8,  'Primera Nacional',     'San Martin Tucuman', 'Quilmes',         '2026-11-29 17:00:00-03', 2.05, 3.05, 3.70),
    (9,  'EFL Championship',     'Sunderland',         'Coventry',        '2026-11-28 12:00:00-03', 2.30, 3.25, 3.10),
    (10, 'Scottish Premiership', 'Hearts',             'Hibernian',       '2026-11-29 12:30:00-03', 2.45, 3.30, 2.80)
) AS v(order_index, competition_name, home_team, away_team, kickoff_time, odd_home, odd_draw, odd_away);

COMMIT;

