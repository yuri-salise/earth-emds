-- ==============================================================================
-- PostgreSQL + PostGIS Initialization Schema for Earth Event & Disaster Monitor
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS country_boundary (
    iso_a3 VARCHAR(3) PRIMARY KEY,
    iso_a2 VARCHAR(2),
    name VARCHAR(120) NOT NULL,
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
    dataset_version VARCHAR(32) NOT NULL DEFAULT 'ne_10m_admin_0_v5.1.1',
    CONSTRAINT chk_valid_iso_a3 CHECK (iso_a3 <> '-99' AND length(trim(iso_a3)) = 3)
);
CREATE INDEX IF NOT EXISTS idx_country_boundary_geom ON country_boundary USING GIST (geom);

CREATE TABLE IF NOT EXISTS country_profile (
    iso_a3 VARCHAR(3) PRIMARY KEY,
    iso_a2 VARCHAR(2),
    name VARCHAR(120) NOT NULL,
    population BIGINT CHECK (population IS NULL OR population >= 0),
    area_sq_km DOUBLE PRECISION CHECK (area_sq_km IS NULL OR area_sq_km >= 0),
    population_density INTEGER,
    currencies JSONB NOT NULL DEFAULT '{}'::jsonb,
    retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    category VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('open', 'closed')),
    closed_at TIMESTAMPTZ,
    sources JSONB NOT NULL DEFAULT '[]'::jsonb,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    news_enriched_on_open BOOLEAN NOT NULL DEFAULT FALSE,
    news_enriched_on_close BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT chk_event_id_nonempty CHECK (length(trim(id)) > 0),
    CONSTRAINT chk_event_title_nonempty CHECK (length(trim(title)) > 0)
);
CREATE INDEX IF NOT EXISTS idx_event_category_status ON event (category, status);
CREATE INDEX IF NOT EXISTS idx_event_last_updated ON event (last_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_title_trgm ON event USING GIN (title gin_trgm_ops);

CREATE TABLE IF NOT EXISTS observation (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(64) NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    observed_at TIMESTAMPTZ NOT NULL,
    geom GEOMETRY(Geometry, 4326) NOT NULL,
    magnitude_value DOUBLE PRECISION,
    magnitude_unit VARCHAR(32),
    CONSTRAINT uq_event_observation UNIQUE (event_id, observed_at),
    CONSTRAINT chk_valid_geom CHECK (ST_IsValid(geom))
);
CREATE INDEX IF NOT EXISTS idx_observation_geom ON observation USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_observation_event_time ON observation (event_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS event_country (
    event_id VARCHAR(64) NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    iso_a3 VARCHAR(3) NOT NULL,
    match_method VARCHAR(32) NOT NULL CHECK (match_method IN ('intersects', 'coastal_proximity')),
    PRIMARY KEY (event_id, iso_a3)
);
CREATE INDEX IF NOT EXISTS idx_event_country_iso ON event_country (iso_a3);

CREATE TABLE IF NOT EXISTS article (
    canonical_url TEXT PRIMARY KEY,
    original_url TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    publisher VARCHAR(160) NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_article_published_at ON article (published_at DESC);

CREATE TABLE IF NOT EXISTS article_match (
    event_id VARCHAR(64) NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    article_url TEXT NOT NULL REFERENCES article(canonical_url) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    confidence_label VARCHAR(16) NOT NULL CHECK (confidence_label IN ('Strong', 'Moderate', 'Weak')),
    match_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    algorithm_version VARCHAR(16) NOT NULL DEFAULT 'v1',
    PRIMARY KEY (event_id, article_url)
);
CREATE INDEX IF NOT EXISTS idx_article_match_event_score ON article_match (event_id, score DESC);

CREATE TABLE IF NOT EXISTS sync_run (
    id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(32) NOT NULL CHECK (provider IN ('eonet', 'rest_countries', 'newsapi')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    outcome VARCHAR(16) NOT NULL CHECK (outcome IN ('success', 'partial', 'error', 'rate_limited')),
    records_processed INTEGER NOT NULL DEFAULT 0,
    error_class VARCHAR(120)
);
CREATE INDEX IF NOT EXISTS idx_sync_run_provider_started ON sync_run (provider, started_at DESC);
