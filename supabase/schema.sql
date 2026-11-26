-- ============================================================================
-- SECCIÓN 1: EXTENSIONES Y TIPOS ENUM (100% MANUAL SIN APIS EXTERNAS)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'matchday_status') THEN
    CREATE TYPE public.matchday_status AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'FINISHED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_status') THEN
    CREATE TYPE public.match_status AS ENUM ('SCHEDULED', 'FINISHED');
  END IF;
END
$$;





-- ============================================================================
-- SECCIÓN 2: TABLAS PRINCIPALES (WHITELIST, PERFILES, FECHAS, PARTIDOS, PRONÓSTICOS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.allowed_users (
  email TEXT PRIMARY KEY CHECK (email = LOWER(TRIM(email))),
  nickname TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE CHECK (email = LOWER(TRIM(email))),
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  total_points INTEGER NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  exact_hits INTEGER NOT NULL DEFAULT 0 CHECK (exact_hits >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.matchdays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status public.matchday_status NOT NULL DEFAULT 'DRAFT',
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT matchdays_valid_window CHECK (closes_at IS NULL OR closes_at > opens_at)
);

CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matchday_id UUID NOT NULL REFERENCES public.matchdays(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL CHECK (order_index BETWEEN 1 AND 10),
  competition_name TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  odd_home NUMERIC(6, 2) CHECK (odd_home IS NULL OR odd_home > 1.00),
  odd_draw NUMERIC(6, 2) CHECK (odd_draw IS NULL OR odd_draw > 1.00),
  odd_away NUMERIC(6, 2) CHECK (odd_away IS NULL OR odd_away > 1.00),
  kickoff_time TIMESTAMPTZ NOT NULL,
  status public.match_status NOT NULL DEFAULT 'SCHEDULED',
  home_score INTEGER CHECK (home_score IS NULL OR home_score >= 0),
  away_score INTEGER CHECK (away_score IS NULL OR away_score >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT matches_matchday_order_unique UNIQUE (matchday_id, order_index)
);

CREATE TABLE IF NOT EXISTS public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  pred_home INTEGER NOT NULL CHECK (pred_home >= 0),
  pred_away INTEGER NOT NULL CHECK (pred_away >= 0),
  points_earned INTEGER NOT NULL DEFAULT 0 CHECK (points_earned IN (0, 1, 3)),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT predictions_user_match_unique UNIQUE (user_id, match_id)
);





-- ============================================================================
-- SECCIÓN 3: ÍNDICES DE RENDIMIENTO
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_matchdays_status_opens
  ON public.matchdays (status, opens_at DESC);

CREATE INDEX IF NOT EXISTS idx_matches_matchday_order
  ON public.matches (matchday_id, order_index ASC);

CREATE INDEX IF NOT EXISTS idx_matches_status
  ON public.matches (status);

CREATE INDEX IF NOT EXISTS idx_predictions_match_id
  ON public.predictions (match_id);

CREATE INDEX IF NOT EXISTS idx_predictions_user_id
  ON public.predictions (user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_ranking
  ON public.profiles (total_points DESC, exact_hits DESC);





-- ============================================================================
-- SECCIÓN 4: FUNCIONES DE AUTORIZACIÓN, CÁLCULO DE PUNTOS Y RPC DEL ADMIN
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_allowed_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.allowed_users au
    WHERE au.email = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.allowed_users au
    WHERE au.email = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')))
      AND au.is_admin = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION public.calculate_points_sql(
  p_pred_home INTEGER,
  p_pred_away INTEGER,
  p_actual_home INTEGER,
  p_actual_away INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_actual_home IS NULL OR p_actual_away IS NULL THEN
    RETURN 0;
  END IF;

  IF p_pred_home = p_actual_home AND p_pred_away = p_actual_away THEN
    RETURN 3;
  END IF;

  IF SIGN(p_pred_home - p_pred_away) = SIGN(p_actual_home - p_actual_away) THEN
    RETURN 1;
  END IF;

  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_match_points(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.match_status;
  v_home_score INTEGER;
  v_away_score INTEGER;
BEGIN
  SELECT status, home_score, away_score
  INTO v_status, v_home_score, v_away_score
  FROM public.matches
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_status = 'FINISHED' AND v_home_score IS NOT NULL AND v_away_score IS NOT NULL THEN
    UPDATE public.predictions
    SET points_earned = public.calculate_points_sql(pred_home, pred_away, v_home_score, v_away_score)
    WHERE match_id = p_match_id;
  ELSE
    UPDATE public.predictions
    SET points_earned = 0
    WHERE match_id = p_match_id;
  END IF;

  UPDATE public.profiles p
  SET
    total_points = COALESCE(sub.total_pts, 0),
    exact_hits = COALESCE(sub.total_exact, 0),
    updated_at = NOW()
  FROM (
    SELECT
      pr.id AS profile_id,
      COALESCE(SUM(pred.points_earned), 0)::INTEGER AS total_pts,
      COUNT(pred.id) FILTER (WHERE pred.points_earned = 3)::INTEGER AS total_exact
    FROM public.profiles pr
    LEFT JOIN public.predictions pred ON pred.user_id = pr.id
    GROUP BY pr.id
  ) sub
  WHERE p.id = sub.profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_match_result_and_recalculate(
  p_match_id UUID,
  p_home_score INTEGER,
  p_away_score INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Solo el administrador puede guardar resultados y recalcular puntajes.';
  END IF;

  IF p_home_score < 0 OR p_away_score < 0 THEN
    RAISE EXCEPTION 'Los goles no pueden ser negativos.';
  END IF;

  UPDATE public.matches
  SET
    home_score = p_home_score,
    away_score = p_away_score,
    status = 'FINISHED',
    updated_at = NOW()
  WHERE id = p_match_id;

  PERFORM public.recalculate_match_points(p_match_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_match_result_and_recalculate(
  p_match_id UUID,
  p_home_score INTEGER,
  p_away_score INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.save_match_result_and_recalculate(p_match_id, p_home_score, p_away_score);
END;
$$;





-- ============================================================================
-- SECCIÓN 5: TRIGGERS DE CREACIÓN DE PERFIL CON GOOGLE, TOPE DE 10 Y PUNTAJES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_max_10_matches_per_matchday()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM public.matches
  WHERE matchday_id = NEW.matchday_id;

  IF v_count >= 10 THEN
    RAISE EXCEPTION 'Cada fecha puede tener como máximo 10 partidos.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_nickname TEXT;
BEGIN
  v_email := LOWER(TRIM(COALESCE(NEW.email, '')));

  SELECT au.nickname
  INTO v_nickname
  FROM public.allowed_users au
  WHERE au.email = v_email;

  IF v_nickname IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    v_email,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), v_nickname),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_allowed_user_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  SELECT
    u.id,
    NEW.email,
    COALESCE(NULLIF(u.raw_user_meta_data ->> 'full_name', ''), NEW.nickname),
    u.raw_user_meta_data ->> 'avatar_url'
  FROM auth.users u
  WHERE LOWER(TRIM(COALESCE(u.email, ''))) = NEW.email
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_recalculate_on_match_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    NEW.status IS DISTINCT FROM OLD.status
    OR NEW.home_score IS DISTINCT FROM OLD.home_score
    OR NEW.away_score IS DISTINCT FROM OLD.away_score
  ) THEN
    PERFORM public.recalculate_match_points(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

DROP TRIGGER IF EXISTS on_allowed_user_added ON public.allowed_users;
CREATE TRIGGER on_allowed_user_added
  AFTER INSERT ON public.allowed_users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_allowed_user_added();

DROP TRIGGER IF EXISTS check_max_10_matches ON public.matches;
CREATE TRIGGER check_max_10_matches
  BEFORE INSERT ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_10_matches_per_matchday();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_matches_updated_at ON public.matches;
CREATE TRIGGER set_matches_updated_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_predictions_updated_at ON public.predictions;
CREATE TRIGGER set_predictions_updated_at
  BEFORE UPDATE ON public.predictions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS on_match_result_changed ON public.matches;
CREATE TRIGGER on_match_result_changed
  AFTER UPDATE OF status, home_score, away_score ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recalculate_on_match_update();





-- ============================================================================
-- SECCIÓN 6: VISTAS DE TABLA DE POSICIONES (RANKING GENERAL Y POR FECHA)
-- ============================================================================

CREATE OR REPLACE VIEW public.leaderboard
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.email,
  COALESCE(NULLIF(au.nickname, ''), p.full_name) AS display_name,
  p.full_name,
  p.avatar_url,
  p.exact_hits,
  COUNT(pred.id) FILTER (WHERE pred.points_earned = 1)::INTEGER AS tendency_hits,
  p.total_points
FROM public.profiles p
LEFT JOIN public.allowed_users au ON au.email = p.email
LEFT JOIN public.predictions pred ON pred.user_id = p.id
GROUP BY p.id, p.email, au.nickname, p.full_name, p.avatar_url, p.exact_hits, p.total_points
ORDER BY
  p.total_points DESC,
  p.exact_hits DESC,
  COUNT(pred.id) FILTER (WHERE pred.points_earned = 1) DESC,
  p.full_name ASC;

CREATE OR REPLACE VIEW public.leaderboard_by_matchday
WITH (security_invoker = true)
AS
SELECT
  md.id AS matchday_id,
  md.name AS matchday_name,
  p.id,
  p.email,
  COALESCE(NULLIF(au.nickname, ''), p.full_name) AS display_name,
  p.full_name,
  p.avatar_url,
  COUNT(pred.id) FILTER (WHERE pred.points_earned = 3)::INTEGER AS exact_hits,
  COUNT(pred.id) FILTER (WHERE pred.points_earned = 1)::INTEGER AS tendency_hits,
  COALESCE(SUM(pred.points_earned), 0)::INTEGER AS total_points
FROM public.matchdays md
CROSS JOIN public.profiles p
LEFT JOIN public.allowed_users au ON au.email = p.email
LEFT JOIN public.matches m ON m.matchday_id = md.id
LEFT JOIN public.predictions pred ON pred.match_id = m.id AND pred.user_id = p.id
WHERE md.status <> 'DRAFT'
GROUP BY md.id, md.name, p.id, p.email, au.nickname, p.full_name, p.avatar_url
ORDER BY
  md.created_at DESC,
  COALESCE(SUM(pred.points_earned), 0) DESC,
  COUNT(pred.id) FILTER (WHERE pred.points_earned = 3) DESC,
  p.full_name ASC;





-- ============================================================================
-- SECCIÓN 7: POLÍTICAS ROW LEVEL SECURITY (SOLO ADMIN GESTIONA FECHAS Y RESULTADOS)
-- ============================================================================

ALTER TABLE public.allowed_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchdays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

-- allowed_users
DROP POLICY IF EXISTS "allowed_users_select_allowed_or_own" ON public.allowed_users;
CREATE POLICY "allowed_users_select_allowed_or_own"
  ON public.allowed_users
  FOR SELECT
  TO authenticated
  USING (
    public.is_allowed_user()
    OR email = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')))
  );

DROP POLICY IF EXISTS "allowed_users_admin_manage" ON public.allowed_users;
CREATE POLICY "allowed_users_admin_manage"
  ON public.allowed_users
  FOR ALL
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- profiles
DROP POLICY IF EXISTS "profiles_select_allowed" ON public.profiles;
CREATE POLICY "profiles_select_allowed"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_allowed_user());

DROP POLICY IF EXISTS "profiles_update_own_safe" ON public.profiles;
CREATE POLICY "profiles_update_own_safe"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid() AND public.is_allowed_user())
  WITH CHECK (
    id = auth.uid()
    AND public.is_allowed_user()
    AND total_points = (SELECT p.total_points FROM public.profiles p WHERE p.id = auth.uid())
    AND exact_hits = (SELECT p.exact_hits FROM public.profiles p WHERE p.id = auth.uid())
  );

-- matchdays
DROP POLICY IF EXISTS "matchdays_select_allowed" ON public.matchdays;
CREATE POLICY "matchdays_select_allowed"
  ON public.matchdays
  FOR SELECT
  TO authenticated
  USING (public.is_allowed_user());

DROP POLICY IF EXISTS "matchdays_admin_manage" ON public.matchdays;
CREATE POLICY "matchdays_admin_manage"
  ON public.matchdays
  FOR ALL
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- matches
DROP POLICY IF EXISTS "matches_select_allowed_visible" ON public.matches;
CREATE POLICY "matches_select_allowed_visible"
  ON public.matches
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin_user()
    OR (
      public.is_allowed_user()
      AND EXISTS (
        SELECT 1
        FROM public.matchdays md
        WHERE md.id = matches.matchday_id
          AND md.status IN ('OPEN', 'CLOSED', 'FINISHED')
          AND NOW() >= md.opens_at
      )
    )
  );

DROP POLICY IF EXISTS "matches_admin_manage" ON public.matches;
CREATE POLICY "matches_admin_manage"
  ON public.matches
  FOR ALL
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- predictions (cierre global por fecha - sin -15m kickoff, solo closes_at)
DROP POLICY IF EXISTS "predictions_select_own_or_locked" ON public.predictions;
CREATE POLICY "predictions_select_own_or_locked"
  ON public.predictions
  FOR SELECT
  TO authenticated
  USING (
    public.is_allowed_user()
    AND (
      public.is_admin_user()
      OR user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.matches m
        JOIN public.matchdays md ON md.id = m.matchday_id
        WHERE m.id = predictions.match_id
          AND md.status IN ('OPEN', 'CLOSED', 'FINISHED')
          AND NOW() >= md.opens_at
          AND (
            m.status = 'FINISHED'
            OR md.status IN ('CLOSED', 'FINISHED')
            OR (md.closes_at IS NOT NULL AND NOW() >= md.closes_at)
          )
      )
    )
  );

DROP POLICY IF EXISTS "predictions_insert_in_window" ON public.predictions;
CREATE POLICY "predictions_insert_in_window"
  ON public.predictions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_allowed_user()
    AND user_id = auth.uid()
    AND points_earned = 0
    AND EXISTS (
      SELECT 1
      FROM public.matches m
      JOIN public.matchdays md ON md.id = m.matchday_id
      WHERE m.id = predictions.match_id
        AND md.status = 'OPEN'
        AND NOW() >= md.opens_at
        AND (md.closes_at IS NULL OR NOW() < md.closes_at)
        AND m.status = 'SCHEDULED'
    )
  );

DROP POLICY IF EXISTS "predictions_update_in_window" ON public.predictions;
CREATE POLICY "predictions_update_in_window"
  ON public.predictions
  FOR UPDATE
  TO authenticated
  USING (
    public.is_allowed_user()
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.matches m
      JOIN public.matchdays md ON md.id = m.matchday_id
      WHERE m.id = predictions.match_id
        AND md.status = 'OPEN'
        AND NOW() >= md.opens_at
        AND (md.closes_at IS NULL OR NOW() < md.closes_at)
        AND m.status = 'SCHEDULED'
    )
  )
  WITH CHECK (
    public.is_allowed_user()
    AND user_id = auth.uid()
    AND points_earned = 0
    AND EXISTS (
      SELECT 1
      FROM public.matches m
      JOIN public.matchdays md ON md.id = m.matchday_id
      WHERE m.id = predictions.match_id
        AND md.status = 'OPEN'
        AND NOW() >= md.opens_at
        AND (md.closes_at IS NULL OR NOW() < md.closes_at)
        AND m.status = 'SCHEDULED'
    )
  );





-- ============================================================================
-- SECCIÓN 8: WHITELIST INICIAL DE EJEMPLO
-- ============================================================================

INSERT INTO public.allowed_users (email, nickname, is_admin)
VALUES
  ('admin@gmail.com', 'El Admin', TRUE),
  ('tincho@gmail.com', 'Tincho', FALSE),
  ('santi@gmail.com', 'Santi', FALSE),
  ('matiitoorres06@gmail.com', 'Mati', TRUE)
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- MIGRACIÓN: Fijar cierre global en la fecha más reciente creada
-- ============================================================================
-- Establece el cierre global a mañana viernes 27 de noviembre de 2026
-- 04:00:00 AM hora Argentina (America/Argentina/Buenos_Aires)
-- Sobre la fecha más recientemente creada (por created_at), sin importar su
-- estado actual (DRAFT/OPEN/CLOSED), para garantizar un corte global
-- consistente en todo el sistema.
UPDATE public.matchdays
SET closes_at = '2026-11-27T04:00:00-03:00'::timestamptz,
    status = 'OPEN'
WHERE id = (
  SELECT id FROM public.matchdays
  ORDER BY created_at DESC
  LIMIT 1
);
