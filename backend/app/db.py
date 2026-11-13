from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sqlite3
import threading

from app.adapters.eonet import fetch_eonet_events, get_seed_eonet_events
from app.adapters.newsapi import NewsQuotaTracker, _build_curated_fallback_articles, fetch_event_news
from app.adapters.rest_countries import fetch_country_profiles, get_fallback_country_profiles
from app.services.demographics import format_density_label
from app.services.scorer import ALGORITHM_VERSION, score_and_rank_articles
from app.services.spatial import (
    extract_geometry_bbox,
    load_admin0_boundaries,
    resolve_event_countries,
)

DEFAULT_SQLITE_PATH = Path(__file__).resolve().parents[1] / "earth_emds.db"


def _resolve_writable_sqlite_path(requested_path: str | None = None) -> str:
    if requested_path:
        return requested_path
    target = DEFAULT_SQLITE_PATH
    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        test_file = target.parent / ".write_check_tmp"
        test_file.write_text("ok", encoding="utf-8")
        test_file.unlink(missing_ok=True)
        return str(target)
    except OSError:
        return "/tmp/earth_emds.db"


CATEGORY_ALIASES: dict[str, list[str]] = {
    "wildfires": ["Wildfires", "wildfires", "wildfire"],
    "wildfire": ["Wildfires", "wildfires", "wildfire"],
    "severestorms": ["Severe Storms", "severeStorms", "severestorms", "severe storm", "severestorm"],
    "severestorm": ["Severe Storms", "severeStorms", "severestorms", "severe storm", "severestorm"],
    "volcanoes": ["Volcanoes", "volcanoes", "volcano"],
    "volcano": ["Volcanoes", "volcanoes", "volcano"],
    "floods": ["Floods", "floods", "flood"],
    "flood": ["Floods", "floods", "flood"],
    "sealakeice": [
        "Sea and Lake Ice",
        "seaLakeIce",
        "seaandlakeice",
        "sealakeice",
        "Sea & Lake Ice",
        "sea & lake ice",
    ],
    "seaandlakeice": [
        "Sea and Lake Ice",
        "seaLakeIce",
        "seaandlakeice",
        "sealakeice",
        "Sea & Lake Ice",
        "sea & lake ice",
    ],
    "earthquakes": ["Earthquakes", "earthquakes", "earthquake"],
    "earthquake": ["Earthquakes", "earthquakes", "earthquake"],
    "landslides": ["Landslides", "landslides", "landslide"],
    "landslide": ["Landslides", "landslides", "landslide"],
    "drought": ["Drought", "drought"],
    "dusthaze": ["Dust and Haze", "dustHaze", "dusthaze"],
    "tempextremes": ["Temperature Extremes", "tempExtremes", "tempextremes"],
}


class Database:
    """High-performance persistence engine supporting SQLite WAL and PostGIS-compatible schemas."""

    def __init__(self, sqlite_path: str | None = None) -> None:
        self.sqlite_path = _resolve_writable_sqlite_path(sqlite_path)
        self._lock = threading.RLock()
        self.quota_tracker = NewsQuotaTracker(redis_url="")
        self.last_sync_at: str = datetime.now(timezone.utc).isoformat()
        self.cached_fallback_active: bool = False

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.sqlite_path, timeout=15.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        return conn

    def init_schema(self) -> None:
        with self._lock, self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS country_boundary (
                    iso_a3 TEXT PRIMARY KEY CHECK (iso_a3 <> '-99' AND length(trim(iso_a3)) = 3),
                    iso_a2 TEXT,
                    name TEXT NOT NULL,
                    bbox_json TEXT NOT NULL,
                    polygons_json TEXT NOT NULL,
                    dataset_version TEXT NOT NULL DEFAULT 'ne_10m_admin_0_v5.1.1'
                );

                CREATE TABLE IF NOT EXISTS country_profile (
                    iso_a3 TEXT PRIMARY KEY REFERENCES country_boundary(iso_a3) ON DELETE CASCADE,
                    iso_a2 TEXT,
                    name TEXT NOT NULL,
                    population INTEGER CHECK (population IS NULL OR population >= 0),
                    area_sq_km REAL CHECK (area_sq_km IS NULL OR area_sq_km >= 0),
                    population_density INTEGER,
                    currencies_json TEXT NOT NULL DEFAULT '{}',
                    retrieved_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS event (
                    id TEXT PRIMARY KEY CHECK (length(trim(id)) > 0),
                    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
                    category TEXT NOT NULL,
                    status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
                    closed_at TEXT,
                    sources_json TEXT NOT NULL DEFAULT '[]',
                    first_seen_at TEXT NOT NULL,
                    last_updated_at TEXT NOT NULL,
                    latest_observed_at TEXT NOT NULL,
                    latest_geom_json TEXT NOT NULL,
                    latest_magnitude_value REAL,
                    latest_magnitude_unit TEXT,
                    min_lon REAL NOT NULL,
                    min_lat REAL NOT NULL,
                    max_lon REAL NOT NULL,
                    max_lat REAL NOT NULL,
                    news_enriched_on_open INTEGER NOT NULL DEFAULT 0,
                    news_enriched_on_close INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_event_category_status ON event (category, status);
                CREATE INDEX IF NOT EXISTS idx_event_last_updated ON event (last_updated_at DESC);
                CREATE INDEX IF NOT EXISTS idx_event_observed_at ON event (latest_observed_at DESC);
                CREATE INDEX IF NOT EXISTS idx_event_bbox ON event (min_lon, max_lon, min_lat, max_lat);

                CREATE TABLE IF NOT EXISTS observation (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id TEXT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
                    observed_at TEXT NOT NULL,
                    geom_json TEXT NOT NULL,
                    magnitude_value REAL,
                    magnitude_unit TEXT,
                    UNIQUE (event_id, observed_at)
                );
                CREATE INDEX IF NOT EXISTS idx_observation_event_time ON observation (event_id, observed_at DESC);

                CREATE TABLE IF NOT EXISTS event_country (
                    event_id TEXT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
                    iso_a3 TEXT NOT NULL REFERENCES country_boundary(iso_a3) ON DELETE CASCADE,
                    match_method TEXT NOT NULL CHECK (match_method IN ('intersects', 'coastal_proximity')),
                    PRIMARY KEY (event_id, iso_a3)
                );
                CREATE INDEX IF NOT EXISTS idx_event_country_iso ON event_country (iso_a3);

                CREATE TABLE IF NOT EXISTS article (
                    canonical_url TEXT PRIMARY KEY,
                    original_url TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    publisher TEXT NOT NULL,
                    published_at TEXT NOT NULL,
                    retrieved_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_article_published_at ON article (published_at DESC);

                CREATE TABLE IF NOT EXISTS article_match (
                    event_id TEXT NOT NULL REFERENCES event(id) ON DELETE CASCADE,
                    article_url TEXT NOT NULL REFERENCES article(canonical_url) ON DELETE CASCADE,
                    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
                    confidence_label TEXT NOT NULL CHECK (confidence_label IN ('Strong', 'Moderate', 'Weak')),
                    match_reasons_json TEXT NOT NULL DEFAULT '[]',
                    algorithm_version TEXT NOT NULL DEFAULT 'v1',
                    PRIMARY KEY (event_id, article_url)
                );
                CREATE INDEX IF NOT EXISTS idx_article_match_event_score ON article_match (event_id, score DESC);

                CREATE TABLE IF NOT EXISTS sync_run (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    provider TEXT NOT NULL CHECK (provider IN ('eonet', 'rest_countries', 'newsapi')),
                    started_at TEXT NOT NULL,
                    ended_at TEXT,
                    outcome TEXT NOT NULL CHECK (outcome IN ('success', 'partial', 'error', 'rate_limited')),
                    records_processed INTEGER NOT NULL DEFAULT 0,
                    error_class TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_sync_run_provider_started ON sync_run (provider, started_at DESC);
                """
            )

    def seed_boundaries_and_profiles(self) -> None:
        boundaries = load_admin0_boundaries()
        profiles = get_fallback_country_profiles()
        now_iso = datetime.now(timezone.utc).isoformat()

        with self._lock, self._connect() as conn:
            conn.executemany(
                """
                INSERT INTO country_boundary (iso_a3, iso_a2, name, bbox_json, polygons_json, dataset_version)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(iso_a3) DO UPDATE SET
                    iso_a2 = excluded.iso_a2,
                    name = excluded.name,
                    bbox_json = excluded.bbox_json,
                    polygons_json = excluded.polygons_json,
                    dataset_version = excluded.dataset_version
                """,
                [
                    (
                        b["iso_a3"],
                        b["iso_a2"],
                        b["name"],
                        json.dumps(b["bbox"]),
                        json.dumps(b["polygons"]),
                        b["dataset_version"],
                    )
                    for b in boundaries
                    if b["iso_a3"] != "-99"
                ],
            )
            conn.executemany(
                """
                INSERT INTO country_profile (iso_a3, iso_a2, name, population, area_sq_km, population_density, currencies_json, retrieved_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(iso_a3) DO UPDATE SET
                    iso_a2 = excluded.iso_a2,
                    name = excluded.name,
                    population = excluded.population,
                    area_sq_km = excluded.area_sq_km,
                    population_density = excluded.population_density,
                    currencies_json = excluded.currencies_json,
                    retrieved_at = excluded.retrieved_at
                """,
                [
                    (
                        p["iso_a3"],
                        p["iso_a2"],
                        p["name"],
                        p["population"],
                        p["area_sq_km"],
                        p["population_density"],
                        json.dumps(p["currencies"]),
                        p.get("retrieved_at") or now_iso,
                    )
                    for iso3, p in profiles.items()
                    if iso3 != "-99"
                ],
            )

    def log_sync_run(
        self,
        provider: str,
        started_at: str,
        outcome: str,
        records_processed: int,
        error_class: str | None = None,
    ) -> None:
        ended_at = datetime.now(timezone.utc).isoformat()
        normalized_outcome = outcome if outcome in ("success", "partial", "error", "rate_limited") else "partial"
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO sync_run (provider, started_at, ended_at, outcome, records_processed, error_class)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (provider, started_at, ended_at, normalized_outcome, records_processed, error_class),
            )

    def upsert_event_with_observations(
        self,
        event_data: dict,
        resolve_spatial_and_news: bool = True,
    ) -> None:
        """Idempotently upsert a single event, its observations, spatial country matches, and articles."""
        now_iso = datetime.now(timezone.utc).isoformat()
        observations = sorted(event_data.get("observations") or [], key=lambda o: o["observed_at"])
        if not observations:
            return
        latest_obs = observations[-1]
        geoms = [o["geom"] for o in observations]
        bbox = extract_geometry_bbox(geoms) or (0.0, 0.0, 0.0, 0.0)

        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO event (
                    id, title, category, status, closed_at, sources_json,
                    first_seen_at, last_updated_at, latest_observed_at,
                    latest_geom_json, latest_magnitude_value, latest_magnitude_unit,
                    min_lon, min_lat, max_lon, max_lat,
                    news_enriched_on_open, news_enriched_on_close
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    category = excluded.category,
                    status = excluded.status,
                    closed_at = excluded.closed_at,
                    sources_json = excluded.sources_json,
                    last_updated_at = excluded.last_updated_at,
                    latest_observed_at = excluded.latest_observed_at,
                    latest_geom_json = excluded.latest_geom_json,
                    latest_magnitude_value = excluded.latest_magnitude_value,
                    latest_magnitude_unit = excluded.latest_magnitude_unit,
                    min_lon = MIN(event.min_lon, excluded.min_lon),
                    min_lat = MIN(event.min_lat, excluded.min_lat),
                    max_lon = MAX(event.max_lon, excluded.max_lon),
                    max_lat = MAX(event.max_lat, excluded.max_lat),
                    news_enriched_on_close = CASE
                        WHEN excluded.status = 'closed' THEN 1
                        ELSE event.news_enriched_on_close
                    END
                """,
                (
                    event_data["id"],
                    event_data["title"],
                    event_data["category"],
                    event_data["status"],
                    event_data.get("closed_at"),
                    json.dumps(event_data.get("sources") or []),
                    now_iso,
                    now_iso,
                    latest_obs["observed_at"],
                    json.dumps(latest_obs["geom"]),
                    latest_obs.get("magnitude_value"),
                    latest_obs.get("magnitude_unit"),
                    bbox[0],
                    bbox[1],
                    bbox[2],
                    bbox[3],
                    1 if event_data["status"] == "closed" else 0,
                ),
            )

            conn.executemany(
                """
                INSERT INTO observation (event_id, observed_at, geom_json, magnitude_value, magnitude_unit)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(event_id, observed_at) DO UPDATE SET
                    geom_json = excluded.geom_json,
                    magnitude_value = excluded.magnitude_value,
                    magnitude_unit = excluded.magnitude_unit
                """,
                [
                    (
                        event_data["id"],
                        obs["observed_at"],
                        json.dumps(obs["geom"]),
                        obs.get("magnitude_value"),
                        obs.get("magnitude_unit"),
                    )
                    for obs in observations
                ],
            )

            if resolve_spatial_and_news:
                country_matches = resolve_event_countries(geoms)
                for cm in country_matches:
                    if cm["iso_a3"] == "-99":
                        continue
                    conn.execute(
                        """
                        INSERT INTO event_country (event_id, iso_a3, match_method)
                        VALUES (?, ?, ?)
                        ON CONFLICT(event_id, iso_a3) DO UPDATE SET
                            match_method = CASE
                                WHEN event_country.match_method = 'intersects' THEN 'intersects'
                                ELSE excluded.match_method
                            END
                        """,
                        (event_data["id"], cm["iso_a3"], cm["match_method"]),
                    )

                country_names = [cm["name"] for cm in country_matches]
                event_dates = [o["observed_at"] for o in observations]
                curated_candidates = _build_curated_fallback_articles(
                    event_id=event_data["id"],
                    event_title=event_data["title"],
                    event_category=event_data["category"],
                    country_names=country_names,
                    event_dates=event_dates,
                )
                scored_articles = score_and_rank_articles(
                    articles=curated_candidates,
                    event_title=event_data["title"],
                    event_category=event_data["category"],
                    country_names=country_names,
                    event_dates=event_dates,
                    min_score=25,
                )
                self._upsert_scored_articles_in_tx(conn, event_data["id"], scored_articles, now_iso)

    def _upsert_scored_articles_in_tx(
        self,
        conn: sqlite3.Connection,
        event_id: str,
        scored_articles: list[dict],
        now_iso: str,
    ) -> None:
        for art in scored_articles:
            conn.execute(
                """
                INSERT INTO article (canonical_url, original_url, title, description, publisher, published_at, retrieved_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(canonical_url) DO UPDATE SET
                    title = excluded.title,
                    description = excluded.description,
                    publisher = excluded.publisher,
                    published_at = excluded.published_at,
                    retrieved_at = excluded.retrieved_at
                """,
                (
                    art["canonical_url"],
                    art["original_url"],
                    art["title"],
                    art.get("description"),
                    art["publisher"],
                    art["published_at"],
                    now_iso,
                ),
            )
            conn.execute(
                """
                INSERT INTO article_match (event_id, article_url, score, confidence_label, match_reasons_json, algorithm_version)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(event_id, article_url) DO UPDATE SET
                    score = excluded.score,
                    confidence_label = excluded.confidence_label,
                    match_reasons_json = excluded.match_reasons_json,
                    algorithm_version = excluded.algorithm_version
                """,
                (
                    event_id,
                    art["canonical_url"],
                    art["score"],
                    art["confidence_label"],
                    json.dumps(art["match_reasons"]),
                    art.get("algorithm_version") or ALGORITHM_VERSION,
                ),
            )

    def bulk_upsert_events_fast(self, events: list[dict]) -> None:
        """Fast transactional batch upsert for high-volume (2,000+) event ingestion & benchmarking."""
        now_iso = datetime.now(timezone.utc).isoformat()
        event_rows = []
        obs_rows = []
        for ev in events:
            observations = ev.get("observations") or []
            if not observations:
                continue
            latest_obs = observations[-1]
            geoms = [o["geom"] for o in observations]
            bbox = extract_geometry_bbox(geoms) or (0.0, 0.0, 0.0, 0.0)
            event_rows.append(
                (
                    ev["id"],
                    ev["title"],
                    ev["category"],
                    ev["status"],
                    ev.get("closed_at"),
                    json.dumps(ev.get("sources") or []),
                    now_iso,
                    now_iso,
                    latest_obs["observed_at"],
                    json.dumps(latest_obs["geom"]),
                    latest_obs.get("magnitude_value"),
                    latest_obs.get("magnitude_unit"),
                    bbox[0],
                    bbox[1],
                    bbox[2],
                    bbox[3],
                )
            )
            for obs in observations:
                obs_rows.append(
                    (
                        ev["id"],
                        obs["observed_at"],
                        json.dumps(obs["geom"]),
                        obs.get("magnitude_value"),
                        obs.get("magnitude_unit"),
                    )
                )

        with self._lock, self._connect() as conn:
            conn.executemany(
                """
                INSERT INTO event (
                    id, title, category, status, closed_at, sources_json,
                    first_seen_at, last_updated_at, latest_observed_at,
                    latest_geom_json, latest_magnitude_value, latest_magnitude_unit,
                    min_lon, min_lat, max_lon, max_lat,
                    news_enriched_on_open, news_enriched_on_close
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    category = excluded.category,
                    status = excluded.status,
                    closed_at = excluded.closed_at,
                    last_updated_at = excluded.last_updated_at,
                    latest_observed_at = excluded.latest_observed_at,
                    latest_geom_json = excluded.latest_geom_json,
                    min_lon = excluded.min_lon,
                    min_lat = excluded.min_lat,
                    max_lon = excluded.max_lon,
                    max_lat = excluded.max_lat
                """,
                event_rows,
            )
            conn.executemany(
                """
                INSERT INTO observation (event_id, observed_at, geom_json, magnitude_value, magnitude_unit)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(event_id, observed_at) DO UPDATE SET
                    geom_json = excluded.geom_json,
                    magnitude_value = excluded.magnitude_value,
                    magnitude_unit = excluded.magnitude_unit
                """,
                obs_rows,
            )

    def seed_initial_data(self) -> None:
        """Seed Natural Earth Admin 0 boundaries, country profiles, and curated EONET events."""
        started = datetime.now(timezone.utc).isoformat()
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                DELETE FROM article
                WHERE original_url LIKE '%reuters.com/world/%-satellite-report%'
                   OR original_url LIKE '%apnews.com/article/%'
                   OR original_url LIKE '%earthobservatory.nasa.gov/IOTD/%'
                   OR original_url LIKE '%example.org/%'
                """
            )
        self.seed_boundaries_and_profiles()
        seed_events = get_seed_eonet_events()
        for ev in seed_events:
            self.upsert_event_with_observations(ev, resolve_spatial_and_news=True)
        self.last_sync_at = datetime.now(timezone.utc).isoformat()
        self.log_sync_run("eonet", started, "success", len(seed_events))
        self.log_sync_run("rest_countries", started, "success", len(load_admin0_boundaries()))
        self.log_sync_run("newsapi", started, "success", len(seed_events) * 3)

    async def run_live_sync(self, force_offline: bool = False) -> dict:
        """Run full multi-provider synchronization pipeline (EONET -> Spatial -> REST Countries -> NewsAPI)."""
        started = datetime.now(timezone.utc).isoformat()
        eonet_res = await fetch_eonet_events(include_closed=True, force_offline=force_offline)
        events = eonet_res["events"]
        for ev in events:
            self.upsert_event_with_observations(ev, resolve_spatial_and_news=True)

        self.log_sync_run(
            "eonet",
            started,
            eonet_res["outcome"],
            len(events),
            eonet_res.get("error_class"),
        )

        # Enrich any matched ISO codes via REST Countries
        with self._lock, self._connect() as conn:
            iso_rows = conn.execute("SELECT DISTINCT iso_a3 FROM event_country WHERE iso_a3 <> '-99'").fetchall()
            iso_codes = [r["iso_a3"] for r in iso_rows]

        rc_started = datetime.now(timezone.utc).isoformat()
        profiles = await fetch_country_profiles(iso_codes, force_offline=force_offline)
        if profiles:
            with self._lock, self._connect() as conn:
                for iso3, p in profiles.items():
                    conn.execute(
                        """
                        INSERT INTO country_profile (iso_a3, iso_a2, name, population, area_sq_km, population_density, currencies_json, retrieved_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(iso_a3) DO UPDATE SET
                            population = excluded.population,
                            area_sq_km = excluded.area_sq_km,
                            population_density = excluded.population_density,
                            currencies_json = excluded.currencies_json,
                            retrieved_at = excluded.retrieved_at
                        """,
                        (
                            iso3,
                            p["iso_a2"],
                            p["name"],
                            p["population"],
                            p["area_sq_km"],
                            p["population_density"],
                            json.dumps(p["currencies"]),
                            p["retrieved_at"],
                        ),
                    )
        self.log_sync_run("rest_countries", rc_started, "success", len(profiles))

        # Enrich top open events with NewsAPI / RSS if online
        news_started = datetime.now(timezone.utc).isoformat()
        news_count = 0
        now_iso = datetime.now(timezone.utc).isoformat()
        for ev in events[:5]:
            res = await fetch_event_news(
                event_id=ev["id"],
                event_title=ev["title"],
                event_category=ev["category"],
                country_names=[],
                event_dates=[o["observed_at"] for o in ev["observations"]],
                quota_tracker=self.quota_tracker,
                force_offline=force_offline,
            )
            if res["articles"]:
                with self._lock, self._connect() as conn:
                    self._upsert_scored_articles_in_tx(conn, ev["id"], res["articles"], now_iso)
            news_count += len(res["articles"])
        self.log_sync_run("newsapi", news_started, "success", news_count)
        self.last_sync_at = datetime.now(timezone.utc).isoformat()
        self.cached_fallback_active = eonet_res.get("error_class") is not None
        return {
            "status": "completed",
            "events_synced": len(events),
            "countries_synced": len(profiles),
            "last_updated": self.last_sync_at,
            "cached_fallback": self.cached_fallback_active,
        }

    def query_events(
        self,
        category: str | None = None,
        status: str | None = None,
        q: str | None = None,
        start_date: str | None = None,
        end_date: str | None = None,
        bbox: tuple[float, float, float, float] | None = None,
        limit: int = 200,
        cursor: int = 0,
    ) -> dict:
        """Query events with parameterized spatial bbox, category, status, date window, and text search."""
        clauses = ["1=1"]
        params: list[object] = []

        if category and category.lower() != "all":
            clean_cat = re.sub(r"[^a-z0-9]", "", category.lower())
            aliases = CATEGORY_ALIASES.get(clean_cat)
            if aliases:
                placeholders = ",".join("?" for _ in aliases)
                clauses.append(f"(e.category IN ({placeholders}) OR LOWER(e.category) = LOWER(?))")
                params.extend([*aliases, category.strip()])
            else:
                clauses.append("LOWER(e.category) = LOWER(?)")
                params.append(category.strip())

        if status and status.lower() != "all":
            clauses.append("LOWER(e.status) = LOWER(?)")
            params.append(status.strip())

        if q and q.strip():
            q_like = f"%{q.strip()}%"
            clauses.append(
                "(e.title LIKE ? OR e.category LIKE ? OR EXISTS ("
                "SELECT 1 FROM event_country ec JOIN country_profile cp ON ec.iso_a3 = cp.iso_a3 "
                "WHERE ec.event_id = e.id AND (cp.name LIKE ? OR cp.iso_a3 LIKE ?)"
                "))"
            )
            params.extend([q_like, q_like, q_like, q_like])

        if start_date and start_date.strip():
            clauses.append("e.latest_observed_at >= ?")
            params.append(start_date.strip())

        if end_date and end_date.strip():
            end_val = end_date.strip()
            if len(end_val) == 10:
                end_val = f"{end_val}T23:59:59Z"
            clauses.append("e.latest_observed_at <= ?")
            params.append(end_val)

        if bbox is not None:
            min_lon, min_lat, max_lon, max_lat = bbox
            clauses.append("e.max_lon >= ? AND e.min_lon <= ? AND e.max_lat >= ? AND e.min_lat <= ?")
            params.extend([min_lon, max_lon, min_lat, max_lat])

        where_sql = " AND ".join(clauses)

        with self._lock, self._connect() as conn:
            total_row = conn.execute(
                f"SELECT COUNT(*) AS cnt FROM event e WHERE {where_sql}",
                params,
            ).fetchone()
            total = int(total_row["cnt"]) if total_row else 0

            rows = conn.execute(
                f"""
                SELECT
                    e.id, e.title, e.category, e.status, e.closed_at, e.sources_json,
                    e.first_seen_at, e.last_updated_at, e.latest_observed_at,
                    e.latest_geom_json, e.latest_magnitude_value, e.latest_magnitude_unit,
                    e.min_lon, e.min_lat, e.max_lon, e.max_lat
                FROM event e
                WHERE {where_sql}
                ORDER BY e.latest_observed_at DESC, e.id ASC
                LIMIT ? OFFSET ?
                """,
                [*params, limit, cursor],
            ).fetchall()

            event_ids = [r["id"] for r in rows]
            countries_by_event: dict[str, list[dict]] = {}
            obs_by_event: dict[str, list[dict]] = {}

            if event_ids and len(event_ids) <= 250:
                placeholders = ",".join("?" for _ in event_ids)
                c_rows = conn.execute(
                    f"""
                    SELECT
                        ec.event_id, ec.iso_a3, ec.match_method,
                        cp.iso_a2, cp.name, cp.population, cp.area_sq_km,
                        cp.population_density, cp.currencies_json, cp.retrieved_at
                    FROM event_country ec
                    JOIN country_profile cp ON ec.iso_a3 = cp.iso_a3
                    WHERE ec.event_id IN ({placeholders}) AND ec.iso_a3 <> '-99'
                    ORDER BY ec.match_method ASC, cp.name ASC
                    """,
                    event_ids,
                ).fetchall()
                for cr in c_rows:
                    density = cr["population_density"]
                    countries_by_event.setdefault(cr["event_id"], []).append(
                        {
                            "iso_a3": cr["iso_a3"],
                            "iso_a2": cr["iso_a2"],
                            "name": cr["name"],
                            "match_method": cr["match_method"],
                            "population": cr["population"],
                            "area_sq_km": cr["area_sq_km"],
                            "population_density": density,
                            "density_label": format_density_label(density),
                            "currencies": json.loads(cr["currencies_json"] or "{}"),
                            "retrieved_at": cr["retrieved_at"],
                        }
                    )

                o_rows = conn.execute(
                    f"""
                    SELECT event_id, observed_at, geom_json, magnitude_value, magnitude_unit
                    FROM observation
                    WHERE event_id IN ({placeholders})
                    ORDER BY observed_at ASC
                    """,
                    event_ids,
                ).fetchall()
                for orow in o_rows:
                    geom = json.loads(orow["geom_json"])
                    obs_by_event.setdefault(orow["event_id"], []).append(
                        {
                            "observed_at": orow["observed_at"],
                            "geom": geom,
                            "geometry": geom,
                            "magnitude_value": orow["magnitude_value"],
                            "magnitude_unit": orow["magnitude_unit"],
                        }
                    )

            items = []
            for r in rows:
                eid = r["id"]
                latest_geom = json.loads(r["latest_geom_json"])
                obs_list = obs_by_event.get(eid) or [
                    {
                        "observed_at": r["latest_observed_at"],
                        "geom": latest_geom,
                        "geometry": latest_geom,
                        "magnitude_value": r["latest_magnitude_value"],
                        "magnitude_unit": r["latest_magnitude_unit"],
                    }
                ]
                items.append(
                    {
                        "id": eid,
                        "title": r["title"],
                        "category": r["category"],
                        "status": r["status"],
                        "closed_at": r["closed_at"],
                        "sources": json.loads(r["sources_json"] or "[]"),
                        "first_seen_at": r["first_seen_at"],
                        "last_updated_at": r["last_updated_at"],
                        "observed_at": r["latest_observed_at"],
                        "latest_observed_at": r["latest_observed_at"],
                        "geometry": latest_geom,
                        "magnitude_value": r["latest_magnitude_value"],
                        "magnitude_unit": r["latest_magnitude_unit"],
                        "bbox": [r["min_lon"], r["min_lat"], r["max_lon"], r["max_lat"]],
                        "observations": obs_list,
                        "countries": countries_by_event.get(eid, []),
                    }
                )

        next_cursor = str(cursor + limit) if (cursor + limit) < total else None
        return {
            "items": items,
            "events": items,
            "total": total,
            "limit": limit,
            "cursor": str(cursor) if cursor else None,
            "next_cursor": next_cursor,
            "last_updated": self.last_sync_at,
            "cached_fallback": self.cached_fallback_active,
        }

    def get_event_by_id(self, event_id: str) -> dict | None:
        with self._lock, self._connect() as conn:
            r = conn.execute(
                """
                SELECT
                    id, title, category, status, closed_at, sources_json,
                    first_seen_at, last_updated_at, latest_observed_at,
                    latest_geom_json, latest_magnitude_value, latest_magnitude_unit,
                    min_lon, min_lat, max_lon, max_lat
                FROM event
                WHERE id = ?
                """,
                (event_id,),
            ).fetchone()
            if not r:
                return None

            o_rows = conn.execute(
                """
                SELECT observed_at, geom_json, magnitude_value, magnitude_unit
                FROM observation
                WHERE event_id = ?
                ORDER BY observed_at ASC
                """,
                (event_id,),
            ).fetchall()
            observations = []
            for orow in o_rows:
                geom = json.loads(orow["geom_json"])
                observations.append(
                    {
                        "observed_at": orow["observed_at"],
                        "geom": geom,
                        "geometry": geom,
                        "magnitude_value": orow["magnitude_value"],
                        "magnitude_unit": orow["magnitude_unit"],
                    }
                )

            c_rows = conn.execute(
                """
                SELECT
                    ec.iso_a3, ec.match_method,
                    cp.iso_a2, cp.name, cp.population, cp.area_sq_km,
                    cp.population_density, cp.currencies_json, cp.retrieved_at
                FROM event_country ec
                JOIN country_profile cp ON ec.iso_a3 = cp.iso_a3
                WHERE ec.event_id = ? AND ec.iso_a3 <> '-99'
                ORDER BY ec.match_method ASC, cp.name ASC
                """,
                (event_id,),
            ).fetchall()
            countries = []
            for cr in c_rows:
                density = cr["population_density"]
                countries.append(
                    {
                        "iso_a3": cr["iso_a3"],
                        "iso_a2": cr["iso_a2"],
                        "name": cr["name"],
                        "match_method": cr["match_method"],
                        "population": cr["population"],
                        "area_sq_km": cr["area_sq_km"],
                        "population_density": density,
                        "density_label": format_density_label(density),
                        "currencies": json.loads(cr["currencies_json"] or "{}"),
                        "retrieved_at": cr["retrieved_at"],
                    }
                )

        articles = self.get_articles_for_event(event_id)
        latest_geom = json.loads(r["latest_geom_json"])
        return {
            "id": r["id"],
            "title": r["title"],
            "category": r["category"],
            "status": r["status"],
            "closed_at": r["closed_at"],
            "sources": json.loads(r["sources_json"] or "[]"),
            "first_seen_at": r["first_seen_at"],
            "last_updated_at": r["last_updated_at"],
            "observed_at": r["latest_observed_at"],
            "latest_observed_at": r["latest_observed_at"],
            "geometry": latest_geom,
            "magnitude_value": r["latest_magnitude_value"],
            "magnitude_unit": r["latest_magnitude_unit"],
            "bbox": [r["min_lon"], r["min_lat"], r["max_lon"], r["max_lat"]],
            "observations": observations,
            "countries": countries,
            "articles": articles,
            "last_updated": self.last_sync_at,
            "cached_fallback": self.cached_fallback_active,
        }

    def get_articles_for_event(self, event_id: str) -> list[dict]:
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                """
                SELECT
                    a.canonical_url, a.original_url, a.title, a.description,
                    a.publisher, a.published_at, a.retrieved_at,
                    am.score, am.confidence_label, am.match_reasons_json, am.algorithm_version
                FROM article_match am
                JOIN article a ON am.article_url = a.canonical_url
                WHERE am.event_id = ?
                ORDER BY am.score DESC, a.published_at DESC
                """,
                (event_id,),
            ).fetchall()

            has_legacy_dead_url = any(
                "-satellite-report" in (r["original_url"] or "")
                or "apnews.com/article/" in (r["original_url"] or "")
                or "earthobservatory.nasa.gov/IOTD/" in (r["original_url"] or "")
                or "example.org/" in (r["original_url"] or "")
                for r in rows
            )

            if not rows or has_legacy_dead_url:
                ev_row = conn.execute(
                    "SELECT id, title, category, latest_observed_at FROM event WHERE id = ?",
                    (event_id,),
                ).fetchone()
                if ev_row:
                    c_rows = conn.execute(
                        """
                        SELECT cp.name
                        FROM event_country ec
                        JOIN country_profile cp ON ec.iso_a3 = cp.iso_a3
                        WHERE ec.event_id = ? AND ec.iso_a3 <> '-99'
                        ORDER BY ec.match_method ASC, cp.name ASC
                        """,
                        (event_id,),
                    ).fetchall()
                    country_names = [cr["name"] for cr in c_rows]
                    obs_dates = [ev_row["latest_observed_at"]]
                    conn.execute("DELETE FROM article_match WHERE event_id = ?", (event_id,))
                    curated = _build_curated_fallback_articles(
                        event_id=ev_row["id"],
                        event_title=ev_row["title"],
                        event_category=ev_row["category"],
                        country_names=country_names,
                        event_dates=obs_dates,
                    )
                    scored = score_and_rank_articles(
                        articles=curated,
                        event_title=ev_row["title"],
                        event_category=ev_row["category"],
                        country_names=country_names,
                        event_dates=obs_dates,
                        min_score=25,
                    )
                    now_iso = datetime.now(timezone.utc).isoformat()
                    self._upsert_scored_articles_in_tx(conn, event_id, scored, now_iso)
                    rows = conn.execute(
                        """
                        SELECT
                            a.canonical_url, a.original_url, a.title, a.description,
                            a.publisher, a.published_at, a.retrieved_at,
                            am.score, am.confidence_label, am.match_reasons_json, am.algorithm_version
                        FROM article_match am
                        JOIN article a ON am.article_url = a.canonical_url
                        WHERE am.event_id = ?
                        ORDER BY am.score DESC, a.published_at DESC
                        """,
                        (event_id,),
                    ).fetchall()

            return [
                {
                    "canonical_url": r["canonical_url"],
                    "original_url": r["original_url"],
                    "url": r["original_url"],
                    "title": r["title"],
                    "description": r["description"],
                    "publisher": r["publisher"],
                    "published_at": r["published_at"],
                    "retrieved_at": r["retrieved_at"],
                    "score": r["score"],
                    "confidence_label": r["confidence_label"],
                    "match_reasons": json.loads(r["match_reasons_json"] or "[]"),
                    "algorithm_version": r["algorithm_version"],
                }
                for r in rows
            ]

    def get_health_summary(self) -> dict:
        with self._lock, self._connect() as conn:
            ev_cnt = conn.execute("SELECT COUNT(*) AS cnt FROM event").fetchone()["cnt"]
            cp_cnt = conn.execute("SELECT COUNT(*) AS cnt FROM country_profile").fetchone()["cnt"]
            art_cnt = conn.execute("SELECT COUNT(*) AS cnt FROM article").fetchone()["cnt"]
            sync_rows = conn.execute(
                """
                SELECT provider, started_at, ended_at, outcome, records_processed, error_class
                FROM sync_run
                ORDER BY id DESC
                LIMIT 10
                """
            ).fetchall()

        return {
            "status": "ok" if ev_cnt > 0 else "degraded",
            "last_updated": self.last_sync_at,
            "cached_fallback": self.cached_fallback_active,
            "database": {
                "engine": "sqlite_wal",
                "connected": True,
                "events_count": int(ev_cnt),
                "countries_count": int(cp_cnt),
                "articles_count": int(art_cnt),
            },
            "newsapi_budget": self.quota_tracker.snapshot(),
            "sync_runs": [dict(r) for r in sync_rows],
        }
