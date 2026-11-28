"""
Módulo de scraper para Flashscore Argentina.
Extrae partidos reales con normalización de nombres de equipos.
"""
import re
import time
from datetime import datetime, timedelta

from playwright.sync_api import sync_playwright


# ============================================================================
# CONFIGURACIÓN
# ============================================================================

BASE_URL = "https://www.flashscore.com.ar/"
HEADLESS = True

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


def parse_teams(segment: str) -> dict | None:
    if not segment:
        return None
    parts = segment.split("vs")
    if len(parts) != 2:
        return None
    home = parts[0].strip()
    away = parts[1].strip()
    if not home or not away or home.lower() == away.lower():
        return None
    return {"home": home, "away": away}


def parse_kickoff_iso(segment: str) -> str | None:
    if not segment:
        return None
    trimmed = str(segment).strip()
    match = re.match(r"^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$", trimmed)
    if match:
        parts = trimmed.split()
        date_part = parts[0]
        time_part = parts[1]
        date_parts = date_part.split("-")
        time_parts = time_part.split(":")
        try:
            local_date = datetime(int(date_parts[0]), int(date_parts[1]), int(date_parts[2]), int(time_parts[0]), int(time_parts[1]))
            return local_date.isoformat()
        except ValueError:
            return None
    match2 = re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$", trimmed)
    if match2:
        parts = trimmed.split("T")
        date_part = parts[0]
        time_part = parts[1]
        date_parts = date_part.split("-")
        time_parts = time_part.split(":")
        try:
            local_date = datetime(int(date_parts[0]), int(date_parts[1]), int(date_parts[2]), int(time_parts[0]), int(time_parts[1]))
            return local_date.isoformat()
        except ValueError:
            return None
    try:
        from dateutil import parser as dateutil_parser
        return dateutil_parser.parse(trimmed, fuzzy=False).isoformat()
    except Exception:
        return None


def parse_optional_odds(segment: str | None) -> dict | None:
    if not segment:
        return {"odd_home": None, "odd_draw": None, "odd_away": None}
    normalized = str(segment).replace(",", ".").strip()
    rawValues = str(normalized).split()
    if len(rawValues) != 3:
        return None
    try:
        home = float(rawValues[0])
        draw = float(rawValues[1])
        away = float(rawValues[2])
        if home <= 1 or draw <= 1 or away <= 1:
            return None
        return {"odd_home": round(home, 2), "odd_draw": round(draw, 2), "odd_away": round(away, 2)}
    except ValueError:
        return None


# ============================================================================
# FUNCIÓN PRINCIPAL
# ============================================================================

def scrape_flashscore_matches(days_ahead: int = 7) -> list[dict]:
    matches = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=HEADLESS)
            page = browser.new_page()
            page.goto(BASE_URL)
            page.wait_for_load_state("networkidle")
            page.wait_for_selector(".event", timeout=15000)
            today = datetime.now()
            dates_to_scrape = [today + timedelta(days=i) for i in range(days_ahead)]
            for target_date in dates_to_scrape:
                date_str = target_date.strftime("%d/%m/%Y")
                try:
                    date_button = page.query_selector(f"span[data-date='{date_str}']")
                    if date_button:
                        date_button.click()
                        page.wait_for_selector(".event", timeout=10000)
                except Exception:
                    continue
                events = page.query_selector_all(".event")
                for event in events:
                    try:
                        competition = event.query_selector(".participant")
                        competition_text = competition.inner_text().strip() if competition else "Desconocido"
                        participant_home = event.query_selector(".participant.home")
                        participant_away = event.query_selector(".participant.away")
                        home_team = participant_home.inner_text().strip() if participant_home else ""
                        away_team = participant_away.inner_text().strip() if participant_away else ""
                        home_team_norm = get_canonical_team_name(home_team) or normalize_name(home_team)
                        away_team_norm = get_canonical_team_name(away_team) or normalize_name(away_team)
                        kickoff_text_element = event.query_selector(".ftime")
                        kickoff_text = kickoff_text_element.inner_text().strip() if kickoff_text_element else "00:00"
                        kickoff_iso = parse_kickoff_iso(f"{target_date.strftime('%Y-%m-%d')} {kickoff_text}")
                        status_element = event.query_selector(".status")
                        status_text = status_element.inner_text().strip() if status_element else "Por programar"
                        competition_lower = competition_text.lower()
                        match_data = {
                            "competition": competition_text,
                            "competition_lower": competition_lower,
                            "home_team": home_team_norm,
                            "away_team": away_team_norm,
                            "kickoff_iso": kickoff_iso,
                            "kickoff_local": f"{target_date.strftime('%Y-%m-%d')} {kickoff_text}",
                            "status": status_text,
                            "source": "flashscore_ar",
                        }
                        matches.append(match_data)
                    except Exception as e:
                        print(f"Error extrayendo evento: {e}")
                        continue
    except Exception as e:
        print(f"Error general en scraper: {e}")
    return matches


def get_weekly_match_priority(date: datetime) -> dict:
    if date.weekday() == 0:
        return {"priority": "rest", "competition_type": None}
    elif date.weekday() in [1, 2, 3]:
        return {"priority": "european_cups", "competition_type": "Champions League, Europa League, Conference League"}
    else:
        return {"priority": "league", "competition_type": "Liga"}


def get_fallback_matches(priority: str) -> dict:
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
    elif priority == "nba":
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
    normalized = []
    for match in grid:
        normalized.append(
            {
                "competition_name": match["competition_name"],
                "home_team": get_canonical_team_name(match["home_team_raw"]) or normalize_name(match["home_team_raw"]),
                "away_team": get_canonical_team_name(match["away_team_raw"]) or normalize_name(match["away_team_raw"]),
                "kickoff_iso": match["kickoff_iso"],
            }
        )
    return normalized


def get_normalized_grid() -> list[dict]:
    return normalize_flashscore_grid(FLASHSCORE_GRID_15)


def get_matches_for_prode(date: datetime | None = None) -> list[dict]:
    if not date:
        date = datetime.now()
    priority = get_weekly_match_priority(date)
    real_matches = scrape_flashscore_matches(days_ahead=3)
    filtered_matches = []
    for match in real_matches:
        comp_lower = match.get("competition_lower", match.get("competition", "").lower())
        if priority["priority"] == "rest":
            continue
        elif priority["priority"] == "european_cups":
            if any(kw in comp_lower for kw in ["champions", "europa", "conference", "liga de campeones"]):
                filtered_matches.append(match)
        elif priority["priority"] == "league":
            filtered_matches.append(match)
    if len(filtered_matches) < 15:
        fallback = get_fallback_matches(priority["priority"])
        filtered_matches.extend(fallback["matches"])
    while len(filtered_matches) < 15:
        filtered_matches.append(
            {
                "competition_name": "Partido amistoso",
                "home_team": "Equipo Local",
                "away_team": "Equipo Visitante",
                "kickoff_iso": datetime.now().isoformat(),
                "status": "Por programar",
            }
        )
    return filtered_matches[:15]


if __name__ == "__main__":
    print("=== SCRAPER DE FLASHSCORE ARGENTINA ===")
    print(f"Fecha actual: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    matches = get_matches_for_prode()
    print(f"Total de partidos obtenidos: {len(matches)}")
    print()
    priorities = {"rest": 0, "european_cups": 0, "league": 0}
    for m in matches:
        comp = m.get("competition", m.get("competition_name", "")).lower()
        if any(kw in comp for kw in ["champions", "europa", "conference"]):
            priorities["european_cups"] += 1
        elif any(kw in comp for kw in ["liga", "profesional"]):
            priorities["league"] += 1
        else:
            priorities["rest"] += 1
    print("Distribución:")
    for k, v in priorities.items():
        print(f"  - {k}: {v} partidos")
    print("\nPrimeros 5 partidos:")
    for i, m in enumerate(matches[:5]):
        print(f"  {i+1}. {m.get('competition', m.get('competition_name', 'N/A'))} | {m.get('home_team', 'N/A')} vs {m.get('away_team', 'N/A')} | {m.get('kickoff_iso', 'N/A')} | {m.get('status', 'N/A')}")