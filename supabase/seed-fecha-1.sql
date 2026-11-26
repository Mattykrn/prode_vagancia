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
-- SECCIÓN 2: FECHA 1 VERIFICADA (ABRE HOY 25/11/2026 - CIERRA 02/12/2026)
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
  status
)
SELECT
  nf.id,
  v.order_index,
  v.competition_name,
  v.home_team,
  v.away_team,
  v.kickoff_time::timestamptz,
  'SCHEDULED'::public.match_status
FROM nueva_fecha nf
CROSS JOIN (
  VALUES
    (1,  'Copa Libertadores',    'Palmeiras',        'Estudiantes de La Plata', '2026-11-28 17:00:00-03'),
    (2,  'Liga Profesional',     'Velez',            'Independiente',           '2026-11-28 20:00:00-03'),
    (3,  'Brasileirao',          'Corinthians',      'Gremio',                  '2026-11-29 18:30:00-03'),
    (4,  'Premier League',       'Arsenal',          'Manchester City',         '2026-11-29 13:30:00-03'),
    (5,  'Premier League',       'Brighton',         'Newcastle',               '2026-11-29 11:05:00-03'),
    (6,  'Serie A',              'Torino',           'Lazio',                   '2026-11-28 14:00:00-03'),
    (7,  'Primera Nacional',     'Deportivo Moron',  'Colon',                   '2026-11-27 21:00:00-03'),
    (8,  'Primera Nacional',     'Deportivo Madryn', 'Gimnasia de Jujuy',       '2026-11-28 20:00:00-03'),
    (9,  'EFL Championship',     'Millwall',         'Burnley',                 '2026-11-28 12:00:00-03'),
    (10, 'Scottish Premiership', 'Motherwell',       'Hibernian',               '2026-11-28 14:45:00-03')
) AS v(order_index, competition_name, home_team, away_team, kickoff_time);

COMMIT;
