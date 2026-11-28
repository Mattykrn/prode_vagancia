"""
Módulo de scraper para Flashscore Argentina.
Extrae partidos reales con normalización de nombres de equipos.

La página principal de Flashscore agrupa los partidos por liga dentro de
contenedores `.sportName`. Cada liga aparece en un `.headerLeague` y a
continuación sus partidos como filas `.event__match`. La navegación de días se
hace con las flechas `[data-day-picker-arrow="next"]` / `"prev"`.
"""
import re
from datetime import datetime, timedelta, timezone

from playwright.sync_api import sync_playwright


# ============================================================================
# CONFIGURACIÓN
# ============================================================================

BASE_URL = "https://www.flashscore.com.ar/"
HEADLESS = True

# Zona horaria de Argentina (UTC-3, sin horario de verano)
ARGENTINA_TZ = timezone(timedelta(hours=-3))

# Diccionario de equivalencias de equipos (cada entrada en una línea)
TEAM_ALIASES = {
    "riverplate": ["river plate", "river", "river Plate"],
    "bocajuniors": ["boca juniors", "boca", "Boca Juniors", "Boca"],
    "independiente": ["independiente", "Racing Club", "Racing"],
    "racing": ["racing club", "Racing Club"],
    "reunion": ["reunion island", "Reunion Island"],
    "realmadrid": ["real madrid", "Real Madrid", "Real"],
    "barcelona": ["barcelona", "FC Barcelona", "Barcelona"],
    "atletemadrid": ["atletico de madrid", "Atleti"],
    "arsenal": ["arsenal", "Arsenal"],
    "chelsea": ["chelsea", "Chelsea"],
    "liverpool": ["liverpool", "Liverpool"],
    "manchesterunited": ["manchester united", "Manchester United", "Man Utd"],
    "mancity": ["manchester city", "Manchester City", "Man City"],
    "tottenham": ["tottenham hotspur", "Tottenham Hotspur", "Spurs"],
    "palmeiras": ["palmeiras", "Palmeiras"],
    "santos": ["santos", "Santos"],
    "corinthians": ["corinthians", "Corinthians"],
    "grmio": ["grmio", "Gremio"],
    "flamengo": ["flamengo", "Flamengo"],
    "juventus": ["juventus", "Juventus"],
    "milan": ["milan", "Milan", "AC Milan", "Inter Milan"],
    "athleticbilbao": ["athletic bilbao", "Athletic Bilbao", "Athletic"],
    "valencia": ["valencia", "Valencia"],
    "paris": ["paris saint-germain", "PSG", "Paris Saint-Germain"],
    "everton": ["everton", "Everton"],
    "sportinguista": ["sporting lisboa", "Sporting Lisbon", "Sporting"],
}


# ============================================================================
# NORMALIZACIÓN DE NOMBRES DE EQUIPOS
# ============================================================================

def normalize_name(name: str) -> str:
    """Normaliza un nombre de equipo: minúsculas, sin tildes, sin signos especiales."""
    if not name:
        return ""
    name = str(name).lower().strip()
    import unicodedata
    name = unicodedata.normalize("NFD", name)
    name = "".join(c for c in name if unicodedata.category(c) != "Mn")
    name = "".join(c for c in name if c.isalnum() or c.isspace())
    name = " ".join(name.split())
    return name.strip()


def get_canonical_team_name(name: str) -> str | None:
    """Busca el nombre canonical de un equipo dado una variante."""
    if not name or not name.strip():
        return None
    normalized = normalize_name(name)
    for canonical, variants in TEAM_ALIASES.items():
        normalized_variants = [normalize_name(v) for v in variants]
        if normalized in normalized_variants:
            return canonical
    return None


def resolve_team_name(raw_name: str) -> str:
    """Devuelve el nombre canónico si existe, o el nombre normalizado como respaldo."""
    return get_canonical_team_name(raw_name) or normalize_name(raw_name)


# ============================================================================
# PARSEO DE FECHAS, HORAS Y CUOTAS
# ============================================================================

def parse_event_time(time_text: str) -> str | None:
    """Extrae HH:MM de un texto como '21:30 SRF' o '22:40'. Devuelve None si no hay hora."""
    if not time_text:
        return None
    match = re.search(r"(\d{1,2}):(\d{2})", str(time_text))
    if not match:
        return None
    hour = int(match.group(1))
    minute = int(match.group(2))
    if hour > 23 or minute > 59:
        return None
    return f"{hour:02d}:{minute:02d}"


def build_kickoff_iso(target_date: datetime, time_text: str) -> str | None:
    """Combina una fecha con un texto de hora y devuelve un ISO con offset -03:00."""
    time_part = parse_event_time(time_text)
    if not time_part:
        return None
    hour_str, minute_str = time_part.split(":")
    local_dt = datetime(
        target_date.year,
        target_date.month,
        target_date.day,
        int(hour_str),
        int(minute_str),
        tzinfo=ARGENTINA_TZ,
    )
    return local_dt.isoformat()


def parse_kickoff_iso(segment: str) -> str | None:
    """Compatibilidad: parsea un string de fecha/hora y devuelve ISO con offset argentino."""
    if not segment:
        return None
    trimmed = str(segment).strip()
    match = re.match(r"^(\d{4})-(\d{2})-(\d{2})[\sT](\d{1,2}):(\d{2})", trimmed)
    if match:
        year, month, day, hour, minute = match.groups()
        try:
            local_dt = datetime(
                int(year), int(month), int(day), int(hour), int(minute), tzinfo=ARGENTINA_TZ
            )
            return local_dt.isoformat()
        except ValueError:
            return None
    return None


def parse_optional_odds(segment: str | None) -> dict | None:
    """Parsea una terna de cuotas '2.30 3.10 2.95'. Devuelve None si es inválida."""
    if not segment:
        return {"odd_home": None, "odd_draw": None, "odd_away": None}
    normalized = str(segment).replace(",", ".").strip()
    raw_values = normalized.split()
    if len(raw_values) != 3:
        return None
    try:
        home = float(raw_values[0])
        draw = float(raw_values[1])
        away = float(raw_values[2])
        if home <= 1 or draw <= 1 or away <= 1:
            return None
        return {
            "odd_home": round(home, 2),
            "odd_draw": round(draw, 2),
            "odd_away": round(away, 2),
        }
    except ValueError:
        return None


# ============================================================================
# EXTRACCIÓN DE PARTIDOS DESDE LA PÁGINA
# ============================================================================

def extract_matches_from_page(page, target_date: datetime) -> list[dict]:
    """Recorre los contenedores .sportName y extrae los partidos reales del día."""
    matches = []
    sport_containers = page.query_selector_all(".sportName")

    for sport in sport_containers:
        children = sport.query_selector_all(":scope > *")
        current_league = "Desconocido"
        current_country = ""

        for child in children:
            class_attr = child.get_attribute("class") or ""

            if "headerLeague" in class_attr:
                title_el = child.query_selector(".headerLeague__title")
                if title_el:
                    current_league = (
                        title_el.get_attribute("title") or title_el.inner_text().strip()
                    )
                category_el = child.query_selector(".headerLeague__category-text")
                current_country = category_el.inner_text().strip() if category_el else ""

            elif "event__match" in class_attr:
                try:
                    home_el = child.query_selector(".event__homeParticipant .wcl-name_jjfMf")
                    away_el = child.query_selector(".event__awayParticipant .wcl-name_jjfMf")
                    home_raw = home_el.inner_text().strip() if home_el else ""
                    away_raw = away_el.inner_text().strip() if away_el else ""
                    if not home_raw or not away_raw:
                        continue

                    time_el = child.query_selector(".event__time")
                    time_text = time_el.inner_text().strip() if time_el else ""

                    stage_el = child.query_selector(".event__stage--block")
                    status_text = stage_el.inner_text().strip() if stage_el else "Por programar"

                    kickoff_iso = build_kickoff_iso(target_date, time_text)

                    match_data = {
                        "competition": current_league,
                        "competition_lower": current_league.lower(),
                        "country": current_country,
                        "home_team": resolve_team_name(home_raw),
                        "away_team": resolve_team_name(away_raw),
                        "home_team_raw": home_raw,
                        "away_team_raw": away_raw,
                        "kickoff_iso": kickoff_iso,
                        "kickoff_local": (
                            f"{target_date.strftime('%Y-%m-%d')} {parse_event_time(time_text)}"
                            if parse_event_time(time_text)
                            else None
                        ),
                        "status": status_text,
                        "source": "flashscore_ar",
                    }
                    matches.append(match_data)
                except Exception as exc:
                    print(f"Error extrayendo evento: {exc}")
                    continue

    return matches


def scrape_flashscore_matches(days_ahead: int = 3) -> list[dict]:
    """Abre Flashscore, navega los próximos días y devuelve los partidos reales."""
    matches = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=HEADLESS)
            page = browser.new_page()
            page.goto(BASE_URL, timeout=60000)
            page.wait_for_load_state("networkidle")
            page.wait_for_selector(".event__match", timeout=20000)

            today = datetime.now(ARGENTINA_TZ)

            for day_offset in range(max(1, days_ahead)):
                target_date = today + timedelta(days=day_offset)
                day_matches = extract_matches_from_page(page, target_date)
                matches.extend(day_matches)

                # Avanzar al día siguiente si todavía faltan días por recorrer
                if day_offset < days_ahead - 1:
                    next_arrow = page.query_selector("[data-day-picker-arrow='next']")
                    if not next_arrow:
                        break
                    try:
                        next_arrow.click()
                        page.wait_for_load_state("networkidle")
                        page.wait_for_selector(".event__match", timeout=15000)
                        page.wait_for_timeout(1500)
                    except Exception as exc:
                        print(f"No se pudo avanzar al día siguiente: {exc}")
                        break

            browser.close()
    except Exception as exc:
        print(f"Error general en scraper: {exc}")
    return matches


# ============================================================================
# REGLAS SEMANALES Y CADENA DE FALLBACK
# ============================================================================

def get_weekly_match_priority(date: datetime) -> dict:
    """Lunes descanso, martes a jueves copas europeas, viernes a domingo ligas."""
    weekday = date.weekday()
    if weekday == 0:
        return {"priority": "rest", "competition_type": None}
    if weekday in (1, 2, 3):
        return {
            "priority": "european_cups",
            "competition_type": "Champions League, Europa League, Conference League",
        }
    return {"priority": "league", "competition_type": "Liga"}


def get_fallback_matches(priority: str) -> dict:
    """1° respaldo juveniles Sub-20, 2° respaldo 10 partidos de NBA."""
    if priority == "sub-20":
        return {
            "matches": [
                {"competition_name": "Sudamericano Sub-20", "home_team": "Argentina Sub-20", "away_team": "Brasil Sub-20", "kickoff_iso": "2025-01-15T20:00:00-03:00"},
                {"competition_name": "Clasificación Sudamericana Sub-20", "home_team": "Uruguay Sub-20", "away_team": "Colombia Sub-20", "kickoff_iso": "2025-01-16T18:00:00-03:00"},
                {"competition_name": "Torneio Internacional Sub-20", "home_team": "Paraguay Sub-20", "away_team": "Perú Sub-20", "kickoff_iso": "2025-01-17T20:00:00-03:00"},
                {"competition_name": "Amistoso Sudamericano Sub-20", "home_team": "Ecuador Sub-20", "away_team": "Venezuela Sub-20", "kickoff_iso": "2025-01-18T16:00:00-03:00"},
                {"competition_name": "Copa Juvenil Norteamericana", "home_team": "México Sub-20", "away_team": "Estados Unidos Sub-20", "kickoff_iso": "2025-01-19T17:00:00-03:00"},
            ],
            "reason": "1° respaldo: selecciones juveniles (Sub-20)",
        }
    if priority == "nba":
        return {
            "matches": [
                {"competition_name": "NBA", "home_team": "Lakers", "away_team": "Celtics", "kickoff_iso": "2025-01-15T20:30:00-03:00"},
                {"competition_name": "NBA", "home_team": "Warriors", "away_team": "Heat", "kickoff_iso": "2025-01-16T21:00:00-03:00"},
                {"competition_name": "NBA", "home_team": "Bulls", "away_team": "Nuggets", "kickoff_iso": "2025-01-17T21:30:00-03:00"},
                {"competition_name": "NBA", "home_team": "Spurs", "away_team": "76ers", "kickoff_iso": "2025-01-18T20:00:00-03:00"},
                {"competition_name": "NBA", "home_team": "Bucks", "away_team": "Raptors", "kickoff_iso": "2025-01-20T21:00:00-03:00"},
            ],
            "reason": "2° respaldo: partidos de NBA",
        }
    return {"matches": [], "reason": "Sin fallback disponible"}


# ============================================================================
# GRILLA DE 15 PARTIDOS NORMALIZADA
# ============================================================================

FLASHSCORE_GRID_15 = [
    {"competition_name": "Premier League", "home_team_raw": "Arsenal", "away_team_raw": "Manchester City", "kickoff_iso": "2026-11-28T20:00:00-03:00"},
    {"competition_name": "LaLiga", "home_team_raw": "Real Madrid", "away_team_raw": "Atlético de Madrid", "kickoff_iso": "2026-11-29T13:30:00-03:00"},
    {"competition_name": "Serie A", "home_team_raw": "Juventus", "away_team_raw": "Inter de Milán", "kickoff_iso": "2026-11-29T16:45:00-03:00"},
    {"competition_name": "Liga Profesional", "home_team_raw": "River Plate", "away_team_raw": "Boca Juniors", "kickoff_iso": "2026-11-28T17:00:00-03:00"},
    {"competition_name": "Liga Profesional", "home_team_raw": "Racing Club", "away_team_raw": "Independiente", "kickoff_iso": "2026-11-28T20:00:00-03:00"},
    {"competition_name": "Liga Profesional", "home_team_raw": "Racing", "away_team_raw": "Racing Club", "kickoff_iso": "2026-11-27T21:10:00-03:00"},
    {"competition_name": "Primera Nacional", "home_team_raw": "Colón", "away_team_raw": "Racing Club", "kickoff_iso": "2026-11-27T21:10:00-03:00"},
    {"competition_name": "Primera Nacional", "home_team_raw": "Defensores de Belgrano", "away_team_raw": "Acassuso", "kickoff_iso": "2026-11-28T19:00:00-03:00"},
    {"competition_name": "Championship", "home_team_raw": "Leeds United", "away_team_raw": "Sheffield United", "kickoff_iso": "2026-11-28T16:45:00-03:00"},
    {"competition_name": "Eredivisie", "home_team_raw": "Ajax", "away_team_raw": "Feyenoord", "kickoff_iso": "2026-11-29T14:00:00-03:00"},
    {"competition_name": "Brasileirão", "home_team_raw": "Palmeiras", "away_team_raw": "Santos", "kickoff_iso": "2026-11-29T18:30:00-03:00"},
    {"competition_name": "Brasileirão", "home_team_raw": "Flamengo", "away_team_raw": "Grêmio", "kickoff_iso": "2026-11-29T20:00:00-03:00"},
    {"competition_name": "Liga MX", "home_team_raw": "América", "away_team_raw": "Chivas", "kickoff_iso": "2026-11-30T17:00:00-03:00"},
    {"competition_name": "Liga MX", "home_team_raw": "Cruz Azul", "away_team_raw": "Pumas", "kickoff_iso": "2026-11-30T19:30:00-03:00"},
    {"competition_name": "Liga Colombiana", "home_team_raw": "Atlético Nacional", "away_team_raw": "Deportes Tolima", "kickoff_iso": "2026-11-30T20:00:00-03:00"},
]


def normalize_flashscore_grid(grid: list[dict]) -> list[dict]:
    """Normaliza los nombres de equipos de la grilla a sus formas canónicas."""
    normalized = []
    for match in grid:
        normalized.append(
            {
                "competition_name": match["competition_name"],
                "home_team": resolve_team_name(match["home_team_raw"]),
                "away_team": resolve_team_name(match["away_team_raw"]),
                "kickoff_iso": match["kickoff_iso"],
            }
        )
    return normalized


def get_normalized_grid() -> list[dict]:
    return normalize_flashscore_grid(FLASHSCORE_GRID_15)


# ============================================================================
# SELECCIÓN DE PARTIDOS PARA EL PRODE
# ============================================================================

def filter_matches_by_priority(real_matches: list[dict], priority: dict, now: datetime | None = None) -> list[dict]:
    """Filtra los partidos reales según la regla semanal (copas europeas o ligas).

    Solo se consideran partidos programados (con kickoff_iso válido y futuro),
    porque los finalizados o en juego no tienen hora de inicio y no sirven para
    apostar.
    """
    reference_now = now or datetime.now(ARGENTINA_TZ)
    filtered = []

    for match in real_matches:
        # Descartar partidos sin hora de inicio (finalizados / en juego)
        kickoff_iso = match.get("kickoff_iso")
        if not kickoff_iso:
            continue

        # Descartar partidos cuyo inicio ya pasó
        try:
            kickoff_dt = datetime.fromisoformat(kickoff_iso)
        except ValueError:
            continue
        if kickoff_dt <= reference_now:
            continue

        comp_lower = match.get("competition_lower", match.get("competition", "").lower())

        if priority["priority"] == "rest":
            continue

        if priority["priority"] == "european_cups":
            cup_keywords = ["champions", "europa", "conference", "liga de campeones"]
            if any(keyword in comp_lower for keyword in cup_keywords):
                filtered.append(match)
            continue

        # priority == "league": se acepta cualquier partido de liga programado
        filtered.append(match)

    # Ordenar por kickoff cronológicamente para tomar los más próximos
    filtered.sort(key=lambda m: m.get("kickoff_iso") or "")
    return filtered


def get_matches_for_prode(date: datetime | None = None) -> list[dict]:
    """Devuelve hasta 15 partidos aplicando prioridad semanal y cadena de fallback."""
    if not date:
        date = datetime.now(ARGENTINA_TZ)

    priority = get_weekly_match_priority(date)
    real_matches = scrape_flashscore_matches(days_ahead=3)
    filtered_matches = filter_matches_by_priority(real_matches, priority)

    # Cadena de fallback: Sub-20 y luego NBA
    if len(filtered_matches) < 15:
        fallback = get_fallback_matches("sub-20")
        filtered_matches.extend(fallback["matches"])

    if len(filtered_matches) < 15:
        fallback_nba = get_fallback_matches("nba")
        filtered_matches.extend(fallback_nba["matches"])

    # Completar con placeholders si todavía falta cupo (nunca debería ocurrir)
    while len(filtered_matches) < 15:
        filtered_matches.append(
            {
                "competition_name": "Partido amistoso",
                "home_team": "Equipo Local",
                "away_team": "Equipo Visitante",
                "kickoff_iso": datetime.now(ARGENTINA_TZ).isoformat(),
                "status": "Por programar",
            }
        )

    return filtered_matches[:15]


# ============================================================================
# EJECUCIÓN DIRECTA
# ============================================================================

if __name__ == "__main__":
    print("=== SCRAPER DE FLASHSCORE ARGENTINA ===")
    print(f"Fecha actual: {datetime.now(ARGENTINA_TZ).strftime('%Y-%m-%d %H:%M:%S %z')}")
    print()

    real = scrape_flashscore_matches(days_ahead=2)
    print(f"Partidos reales extraídos: {len(real)}")
    print("Muestra (primeros 10):")
    for index, match in enumerate(real[:10]):
        print(
            f"  {index + 1}. [{match['competition']}] "
            f"{match['home_team_raw']} vs {match['away_team_raw']} | "
            f"{match['kickoff_iso'] or 'sin hora'} | {match['status']}"
        )
    print()

    matches = get_matches_for_prode()
    print(f"Total de partidos para el prode: {len(matches)}")
    print()

    print("Primeros 5 de la grilla final:")
    for index, match in enumerate(matches[:5]):
        competition = match.get("competition", match.get("competition_name", "N/A"))
        home = match.get("home_team", "N/A")
        away = match.get("away_team", "N/A")
        kickoff = match.get("kickoff_iso", "N/A")
        print(f"  {index + 1}. {competition} | {home} vs {away} | {kickoff}")
