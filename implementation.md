# Implementation Plan & Architecture Guide: Earth Event & Disaster Monitoring System (`earth-emds`)

This document provides the complete technical architecture, repository layout, database schema, security controls, Test-Driven Development (TDD) workflow, End-to-End (E2E) testing strategy, and sprint-by-sprint implementation roadmap to build the **Earth Event & Disaster Monitoring System**.

---

## 1. System Architecture & Repository Structure

The system uses a **five-container modular architecture** orchestrated via Docker Compose:
1. **`frontend/`** — React + TypeScript + Vite + CesiumJS web client (Port `3000` / `80`)
2. **`backend/` (API Service)** — Python 3.11+ FastAPI read-only application gateway (Port `8000`)
3. **`backend/` (Ingestion Worker)** — Scheduled Python background worker (10-minute EONET sync, PostGIS country containment, REST Countries enrichment, and budgeted NewsAPI scoring)
4. **`db` (Spatial Database)** — PostgreSQL 16 + PostGIS 3.4 (`postgis/postgis:16-3.4-alpine`, internal port `5432`)
5. **`redis` (Cache & Quota Store)** — Redis 7 (`redis:7-alpine`, internal port `6379`)

```text
earth-emds/
├── docker-compose.yml
├── .env.example
├── product.md
├── implementation.md
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml / requirements.txt
│   ├── alembic/                      # Database migrations
│   ├── data/
│   │   └── ne_10m_admin_0_countries/ # Versioned Natural Earth Admin 0 dataset
│   ├── app/
│   │   ├── main.py                   # FastAPI app, CORS, rate limiting, endpoints & routers
│   │   ├── config.py                 # Pydantic Settings (.env loader)
│   │   ├── db.py                     # SQLite WAL / PostGIS connection pool and query engine
│   │   ├── cache.py                  # Redis cache & NewsAPI daily quota counter
│   │   ├── adapters/
│   │   │   ├── eonet.py              # NASA EONET v3 client (timeouts + jittered retries)
│   │   │   ├── rest_countries.py     # REST Countries v3.1 client (/alpha batch lookup)
│   │   │   └── newsapi.py            # NewsAPI v2 client (/v2/everything + X-Api-Key header)
│   │   ├── services/
│   │   │   ├── normalizer.py         # Title cleanup, null magnitude, URL canonicalization
│   │   │   ├── spatial.py            # PostGIS ST_Intersects + coastal ST_DWithin resolution
│   │   │   ├── demographics.py       # Population density math & zero/null area guards
│   │   │   └── scorer.py             # Rule-based NewsAPI candidate scoring (algorithm_version 1)
│   │   └── worker/
│   │       └── scheduler.py / __main__.py # 10-min ingestion pipeline & sync_run logger
│   └── tests/
│       ├── unit/                     # Fast TDD unit tests (normalizer, scorer, density, schemas)
│       ├── contract/                 # Adapter contract tests with recorded JSON fixtures
│       └── integration/              # PostGIS spatial queries, Redis fallback, FastAPI routes
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── api/                      # Typed fetch client for /api/v1/*
    │   ├── types/                    # GeoJSON, Event, CountryProfile, ScoredArticle types
    │   ├── components/
    │   │   ├── GlobeView.tsx         # CesiumJS 3D globe (points, lines, polygons, bbox listener)
    │   │   ├── EventSidebarList.tsx  # Keyboard-accessible list view & search/filter controls
    │   │   ├── EventDetailDrawer.tsx # Event metadata, observation timeline, source links
    │   │   ├── CountryCard.tsx       # REST Countries metrics + national density disclaimer
    │   │   ├── ArticleList.tsx       # Ranked news items + match reason badges + disclaimer
    │   │   └── FreshnessBanner.tsx   # Sync timestamp & degraded upstream fallback alert
    │   └── test/                     # Vitest + React Testing Library component tests
    └── e2e/                          # Playwright End-to-End (E2E) test suites
        ├── playwright.config.ts
        ├── exploration.spec.ts
        ├── accessibility.spec.ts
        └── resilience.spec.ts
```

---

## 2. Database Schema & Postgres/PostGIS Best Practices

Following PostgreSQL and PostGIS best practices:
- **Extensions:** Enable `postgis` (for `GEOMETRY(Geometry, 4326)` and `GIST` spatial indexing) and `pg_trgm` (for fast text search on event titles).
- **Coordinate Order:** Strictly store WGS 84 `[longitude, latitude]` in `EPSG:4326` per RFC 7946.
- **Indexes on Foreign Keys & Filter Columns:** Always index foreign keys (`event_id`, `iso_a3`, `article_url`), spatial columns (`USING GIST`), and frequent filter predicates (`category`, `status`, `observed_at DESC`).
- **Connection Management:** Use bounded async connection pooling (`SQLAlchemy` + `asyncpg`) so interactive reads are never starved by the background ingestion worker.

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Natural Earth Admin 0 Reference Layer (1:10m)
CREATE TABLE country_boundary (
    iso_a3 VARCHAR(3) PRIMARY KEY,
    iso_a2 VARCHAR(2),
    name VARCHAR(120) NOT NULL,
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
    dataset_version VARCHAR(32) NOT NULL DEFAULT 'ne_10m_admin_0_v5.1.1',
    CONSTRAINT chk_valid_iso_a3 CHECK (iso_a3 <> '-99' AND length(trim(iso_a3)) = 3)
);
CREATE INDEX idx_country_boundary_geom ON country_boundary USING GIST (geom);

-- 2. Enriched Country Demographic Profile (REST Countries v3.1)
CREATE TABLE country_profile (
    iso_a3 VARCHAR(3) PRIMARY KEY REFERENCES country_boundary(iso_a3) ON DELETE CASCADE,
    iso_a2 VARCHAR(2),
    name VARCHAR(120) NOT NULL,
    population BIGINT CHECK (population IS NULL OR population >= 0),
    area_sq_km DOUBLE PRECISION CHECK (area_sq_km IS NULL OR area_sq_km >= 0),
    population_density INTEGER, -- round(population / area_sq_km); NULL if area_sq_km <= 0 or NULL
    currencies JSONB NOT NULL DEFAULT '{}'::jsonb,
    retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Primary Scientific Event Record (NASA EONET v3)
CREATE TABLE event (
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
CREATE INDEX idx_event_category_status ON event (category, status);
CREATE INDEX idx_event_last_updated ON event (last_updated_at DESC);
CREATE INDEX idx_event_title_trgm ON event USING GIN (title gin_trgm_ops);

-- 4. Dated Spatial Observations (Point, LineString, Polygon)
CREATE TABLE observation (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(64) NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    observed_at TIMESTAMPTZ NOT NULL,
    geom GEOMETRY(Geometry, 4326) NOT NULL,
    magnitude_value DOUBLE PRECISION,
    magnitude_unit VARCHAR(32),
    CONSTRAINT uq_event_observation UNIQUE (event_id, observed_at),
    CONSTRAINT chk_valid_geom CHECK (ST_IsValid(geom))
);
CREATE INDEX idx_observation_geom ON observation USING GIST (geom);
CREATE INDEX idx_observation_event_time ON observation (event_id, observed_at DESC);

-- 5. Event-to-Country Spatial Join Table
CREATE TABLE event_country (
    event_id VARCHAR(64) NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    iso_a3 VARCHAR(3) NOT NULL REFERENCES country_boundary(iso_a3) ON DELETE CASCADE,
    match_method VARCHAR(32) NOT NULL CHECK (match_method IN ('intersects', 'coastal_proximity')),
    PRIMARY KEY (event_id, iso_a3)
);
CREATE INDEX idx_event_country_iso ON event_country (iso_a3);

-- 6. Deduplicated News Articles (NewsAPI v2)
CREATE TABLE article (
    canonical_url TEXT PRIMARY KEY,
    original_url TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    publisher VARCHAR(160) NOT NULL,
    published_at TIMESTAMPTZ NOT NULL,
    retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_article_published_at ON article (published_at DESC);

-- 7. Explainable Event-to-Article Match Evidence
CREATE TABLE article_match (
    event_id VARCHAR(64) NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    article_url TEXT NOT NULL REFERENCES article(canonical_url) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    confidence_label VARCHAR(16) NOT NULL CHECK (confidence_label IN ('Strong', 'Moderate', 'Weak')),
    match_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    algorithm_version VARCHAR(16) NOT NULL DEFAULT 'v1',
    PRIMARY KEY (event_id, article_url)
);
CREATE INDEX idx_article_match_event_score ON article_match (event_id, score DESC);

-- 8. Provider Synchronization & Observability Log
CREATE TABLE sync_run (
    id BIGSERIAL PRIMARY KEY,
    provider VARCHAR(32) NOT NULL CHECK (provider IN ('eonet', 'rest_countries', 'newsapi')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    outcome VARCHAR(16) NOT NULL CHECK (outcome IN ('success', 'partial', 'error', 'rate_limited')),
    records_processed INTEGER NOT NULL DEFAULT 0,
    error_class VARCHAR(120)
);
CREATE INDEX idx_sync_run_provider_started ON sync_run (provider, started_at DESC);
```

---

## 3. Core Domain Rules & Integration Contracts

### 3.1 NASA EONET v3 Adapter (`eonet.py`)
- **Endpoint:** `GET https://eonet.gsfc.nasa.gov/api/v3/events?status=open` and recent `status=closed&limit=100`
- **Schedule:** Every 10 minutes.
- **Normalization Rules:**
  - Trim and collapse non-standard whitespace in `title`.
  - Keep `closed` as `null` for open events.
  - Store missing `magnitudeValue` strictly as `null` (never `0`).
  - Upsert `event` and each item in `geometry[]` into `observation` (`ON CONFLICT (event_id, observed_at) DO UPDATE`), preserving movement history.

### 3.2 PostGIS Country Resolution & REST Countries v3.1 (`spatial.py`, `rest_countries.py`)
- **Boundary Dataset:** Natural Earth Admin 0 (1:10m). Filter out any polygon where `iso_a3 = '-99'` (e.g., Somaliland) during import and query time so downstream REST Countries calls never fail with HTTP `400`.
- **Spatial Matching:**
  1. Primary containment: `ST_Intersects(c.geom, o.geom)` (`match_method = 'intersects'`).
  2. Offshore coastal fallback: If no land polygon intersects, check `ST_DWithin(c.geom::geography, o.geom::geography, 100000)` (100 km coastal buffer, `match_method = 'coastal_proximity'`).
- **Demographic Enrichment:** Batch lookup `GET https://restcountries.com/v3.1/alpha?codes={codes}&fields=name,cca2,cca3,population,area,currencies`.
- **Population Density Formula:**
  - If `area <= 0` or `area is None` or `population is None`: `population_density = None` (bypasses division to prevent `ZeroDivisionError` or bogus infinity).
  - Otherwise: `round(population / area)` as an integer, labeled strictly as **National Average (people/km²)**.

### 3.3 NewsAPI v2 Adapter, Budget Control & Rule-Based Scoring (`newsapi.py`, `scorer.py`)
- **Endpoint:** `GET https://newsapi.org/v2/everything` with `X-Api-Key` header, `searchIn=title,description`, `language=en`.
- **Quota & Budget Strategy:**
  - Free Developer plan limit is 100 requests/day (with a 24-hour article delay and 1-month archive window).
  - Enforce a hard daily cap in Redis (`newsapi:quota:YYYY-MM-DD`, limit `90`, keeping a 10-request reserve).
  - Enrich each event **once upon discovery** (`news_enriched_on_open = TRUE`) and **once at closure** (`news_enriched_on_close = TRUE`).
- **Canonical URL Deduplication:**
  - Normalize URLs before hashing/inserting by stripping tracking parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `fbclid`, `gclid`, `ref`) and trailing slashes.
- **Explainable Scoring Rubric (`algorithm_version = 'v1'`):**
  - `+35 pts` — Event specific name/location phrase appears in article title (`"Matched event title phrase in headline"`).
  - `+25 pts` — Hazard category keyword (`wildfire`, `typhoon`, `hurricane`, `volcano`, `eruption`, `flood`, etc.) in title or description (`"Matched hazard category keyword '<keyword>'"`).
  - `+25 pts` — Matched country or administrative place name in title or description (`"Matched country/location '<country>'"`).
  - `+15 pts` — Article published within the active event observation window $\pm 72$ hours (`"Published within event date window"`).
  - **Confidence Labels:** `Strong` ($\ge 70$), `Moderate` ($45\text{–}69$), `Weak` ($25\text{–}44$; discard $< 25$).

---

## 4. Free APIs Strategy & `.env` Configuration Guide

To keep the project **100% free** to develop, test, and demonstrate:

| Data / Map Layer | Primary Provider | Cost & Key Requirement | Free Keyless Fallback / Resilience |
| :--- | :--- | :--- | :--- |
| **Hazard Events & Geometries** | **NASA EONET v3** (`https://eonet.gsfc.nasa.gov/api/v3`) | **100% Free — No API Key Required** | Cached PostGIS + Redis snapshots (`event`, `observation`) |
| **Country Boundaries** | **Natural Earth Admin 0 (1:10m)** | **100% Free Public Domain — No API Key Required** | Stored locally inside `backend/data/` and loaded into PostGIS |
| **Demographic Context** | **REST Countries v3.1** (`https://restcountries.com/v3.1`) | **100% Free — No API Key Required** | Cached permanently in `country_profile` table with versioned TTL |
| **3D Globe Basemaps** | **Esri World Imagery / CARTO Dark Matter / OpenStreetMap** | **100% Free — No API Key Required** (`VITE_CESIUM_ION_TOKEN` is optional) | Configured with `Ion.defaultAccessToken = ""` and open `UrlTemplateImageryProvider` |
| **News Discovery** | **NewsAPI v2** (`https://newsapi.org/v2/everything`) | **Free Developer Plan (100 req/day)** — Requires free `NEWSAPI_KEY` | If `NEWSAPI_KEY` is blank or daily budget (`90`) is exhausted, falls back to cached DB articles + optional keyless Google News RSS / GDELT 2.0 Doc feed |

### How to Get & Paste Your Free `NEWSAPI_KEY`
1. Visit **[https://newsapi.org/register](https://newsapi.org/register)** (takes ~30 seconds, free Developer tier).
2. Copy the generated 32-character API key.
3. Open [`.env`](file:///C:/Users/Yuri/Desktop/React/earth-emds/.env) in the project root and paste it on line 12:
   ```env
   NEWSAPI_KEY=your_32_character_key_here
   ```

---

## 5. Modern Minimalist UI/UX & Low-Spec Hardware Optimization

### 5.1 Minimalist UI Engineering
- **Layout:** Single-screen responsive split/overlay view—no page reloads, no nested modals, and no cluttered toolbars.
- **Design Tokens:** Dark slate background (`#090D16`), translucent surface cards (`rgba(15, 23, 42, 0.78)`), subtle borders (`rgba(148, 163, 184, 0.16)`), crisp semantic status badges, and explicit uncertainty pill tags.

### 5.2 Optimizing Heavy CesiumJS 3D Rendering ("Katong sa mabigat" / Low-Spec Laptops)
To prevent browser lag, high fan noise, or GPU crashes on laptops with integrated graphics:
1. **Demand-Driven Rendering Loop:**
   ```ts
   const viewer = new Cesium.Viewer(container, {
     requestRenderMode: true,
     maximumRenderTimeChange: Infinity,
     terrainProvider: new Cesium.EllipsoidTerrainProvider(), // Zero terrain mesh overhead by default
     skyAtmosphere: false,
     shadows: false,
     timeline: false,
     animation: false,
     baseLayerPicker: false,
     geocoder: false,
   });
   ```
2. **Resolution Capping & Entity Clustering:** Cap `viewer.resolutionScale = Math.min(window.devicePixelRatio, 1.25)` and enable `DataSource.clustering` so 2,000 events render at 60 FPS without thousands of individual DOM/WebGL draw calls.
3. **1-Click "Lite Mode" (3D Globe Pause / 2D List-Only Mode):** Provide a persistent header toggle (`3D Globe` ↔ `Lite List Mode`) that unmounts the WebGL context on low-spec machines while keeping all filters, country profiles, and scored news articles 100% functional.

---

## 6. Security Architecture — Backend, Frontend & Docker (`NFR-04`)

1. **Server-Side Secret Isolation:**
   - `NEWSAPI_KEY` and `POSTGRES_PASSWORD` are loaded from `.env` via Pydantic `BaseSettings` inside `backend` and `worker` only.
   - The `frontend` container never receives `NEWSAPI_KEY`. Automated security tests assert that secrets never leak in `/api/v1/*` responses, headers, or error traces.
2. **Read-Only Public API & Strict Input Validation:**
   - Expose only `GET` routes under `/api/v1/*` (`GET /api/v1/events`, `GET /api/v1/events/{id}`, `GET /api/v1/events/{id}/articles`, `GET /api/v1/health`).
   - Validate all query parameters (`category`, `status`, `start_date`, `end_date`, `bbox` as `[minLon, minLat, maxLon, maxLat]` within `[-180..180, -90..90]`, `limit <= 2000`, `cursor`) via Pydantic v2 models.
   - Use parameterized SQLAlchemy queries exclusively—never interpolate strings into PostGIS `ST_MakeEnvelope` or `ILIKE` clauses.
3. **Docker Security Hardening:**
   - **Non-Root Execution:** Both `backend/Dockerfile` and `frontend/Dockerfile` create and run as an unprivileged user (`USER appuser`, UID `10001`).
   - **Multi-Stage Slim Images:** Build dependencies are stripped in final runtime stages (`python:3.11-slim` and `nginx:1.27-alpine`).
   - **Container Runtime Privileges:** Set `security_opt: ["no-new-privileges:true"]`, `cap_drop: ["ALL"]`, bounded memory/CPU limits, and `read_only: true` root filesystems (with `tmpfs: [/tmp]`) on application containers.
   - **Internal Network Segmentation:** Place `db` (`5432`) and `redis` (`6379`) on an internal bridge network (`backend_net` with `internal: true` in production) so only `backend` and `worker` can reach them.
   - **Healthchecks & Startup Ordering:** Every container defines a native `healthcheck` (`pg_isready`, `redis-cli ping`, `urllib.request.urlopen('http://localhost:8000/api/v1/health')`) paired with `depends_on: condition: service_healthy`.
4. **HTTP & Redirect Hardening:**
   - Configure FastAPI `CORSMiddleware` to allow `GET` and `OPTIONS` only from `FRONTEND_ORIGIN`.
   - Attach security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy`).
   - Store only headline, short snippet, publisher name, publication date, and URL; all external links in React render with `target="_blank" rel="noopener noreferrer"`.

---

## 7. Test-Driven Development (TDD) & End-to-End (E2E) Testing Strategy

Every feature follows the **Red → Green → Refactor** cycle before merging:
1. **Red:** Write a failing unit, contract, integration, or E2E test that codifies the requirement (`FR-*` / `NFR-*`).
2. **Green:** Write the minimal, cleanest code that passes the test.
3. **Refactor:** Clean up duplication while keeping all tests green.

### 7.1 Backend Test Pyramid (`pytest`)
- **Layer 1: Unit Tests (`backend/tests/unit/`) — Fast, zero I/O**
  - `test_normalizer.py`: Verifies messy EONET title trimming, `magnitudeValue: null` preservation, WGS 84 coordinate validation, and URL canonicalization (`?utm_source=...` stripping).
  - `test_demographics.py`: Verifies `round(population / area)` calculation and confirms `area = 0`, `area = None`, or negative values safely return `None`.
  - `test_scorer.py`: Tests `algorithm_version 1` scoring weights on labeled candidate articles, verifying exact `score`, `confidence_label`, and `match_reasons` list.
- **Layer 2: Provider Contract Tests (`backend/tests/contract/`) — Recorded Fixtures (`respx` / `pytest-httpx`)**
  - `test_eonet_adapter.py`: Tests parsing of Point, LineString, and Polygon EONET v3 payloads, plus retry/backoff on HTTP `503`/timeout.
  - `test_rest_countries_adapter.py`: Tests `/v3.1/alpha` parsing, missing `currencies`/`area` handling, and omission of `iso_a3 = '-99'`.
  - `test_newsapi_adapter.py`: Tests `X-Api-Key` header injection, HTTP `401`/`429` handling, and Redis daily budget guard (`90` req/day cap).
- **Layer 3: Database & API Integration Tests (`backend/tests/integration/`) — Real PostGIS + Redis**
  - `test_spatial_matching.py`: Inserts sample Point, LineString, and multi-country Polygon observations into PostGIS and asserts `ST_Intersects` and coastal `ST_DWithin` return expected ISO codes.
  - `test_idempotent_upsert.py`: Runs the EONET sync twice on the same payload and on an updated observation timestamp, asserting zero duplicate events and preserved observation history.
  - `test_api_and_fallback.py`: Tests `GET /api/v1/events` viewport `bbox` filtering performance (`< 2s` for 2,000 events), simulates an upstream outage, and verifies cached data + freshness timestamps are returned without leaking `NEWSAPI_KEY`.

### 7.2 Frontend Unit & Component Tests (`Vitest` + `React Testing Library`)
- Verify filter bar controls, Lite Mode toggle, keyboard navigation on `EventSidebarList`, rendering of `CountryCard` (including `null` density fallback), `ArticleList` match reason badges, and presence of all three mandatory data disclaimers.

### 7.3 End-to-End (E2E) Testing (`Playwright` — `frontend/e2e/`)
Playwright tests run against the full containerized stack (`docker compose up`):
1. **`exploration.spec.ts` (Primary User Journey & Performance):**
   - Loads the app, verifies the CesiumJS globe container (or Lite Mode toggle) and sidebar event list render open events with a visible `last_updated` timestamp.
   - Filters by category (`Wildfires`), status (`open`), and date range; asserts the API responds in `< 2000ms` and the list updates deterministically.
   - Selects an event and verifies the detail drawer displays EONET metadata, Country Profile Card (population, area, national density + national scale label), ranked NewsAPI articles with human-readable match reasons, and external links with `rel="noopener noreferrer"`.
2. **`accessibility.spec.ts` (Keyboard & ARIA Verification — `NFR-06`):**
   - Navigates from search input → category filter → event list → event detail drawer → article links using only keyboard (`Tab`, `Enter`, `Escape`) without touching the mouse or WebGL canvas.
   - Runs `@axe-core/playwright` to verify zero critical accessibility or contrast violations and confirms all three uncertainty disclaimers are visible in the DOM.
3. **`resilience.spec.ts` (Outage & Rate-Limit Simulation — `FR-12`, `NFR-03`, `NFR-04`):**
   - Simulates upstream NewsAPI `429` / EONET outage state and verifies the UI continues rendering cached events and articles while displaying the `FreshnessBanner` with cached age.
   - Inspects all browser network requests and response payloads to assert `NEWSAPI_KEY` and internal DB credentials are never exposed to the client.

### 7.4 Docker Compose Verification & Container Smoke Tests
- `docker compose config -q` validates compose syntax and environment variable interpolation.
- `docker compose --profile test run --rm backend-test pytest` runs the full unit, contract, and PostGIS/Redis integration suite inside the isolated Docker network.
- `docker compose --profile test run --rm e2e-test npx playwright test` executes all Playwright E2E specs against the live containerized stack.

## 7.5 Git & Code Maintainability Guardrails (No Bulk Commits)
- **Atomic Commits Only (`.githooks/pre-commit` & `.agent/rules/atomic-commits.md`):**
  - Never use `git add .` or `git commit -a` to dump unrelated files in bulk.
  - Pre-commit hook enforces: (1) `.env` files are strictly blocked, (2) max 8 staged files per commit, and (3) `frontend/` and `backend/` changes cannot be mixed in the same commit.
  - Every commit must represent one testable, single-responsibility unit (`docs`, `chore(docker)`, `test(backend)`, `feat(backend)`, `test(frontend)`, `feat(frontend)`).

---

## 8. Verified Agent Skills for This Project

In addition to our installed skills (`supabase-postgres-best-practices`, `react-best-practices`, `ponytail`, `verification`), the following high-trust, high-install skills from `skills.sh` match this stack:

| Skill Package | Installs & Source | Purpose in `earth-emds` | Install Command |
| :--- | :--- | :--- | :--- |
| **`anthropics/skills@frontend-design`** | **1.1M+ installs** (Official Anthropic) | Modern, minimalistic, high-craft UI/UX design for the dashboard, filter bar, and drawer | `npx skills add anthropics/skills@frontend-design -g -y` |
| **`microsoft/playwright-cli@playwright-cli`** | **211K+ installs** (Official Microsoft) | Playwright End-to-End (E2E) test authoring, accessibility checks, and browser automation | `npx skills add microsoft/playwright-cli@playwright-cli -g -y` |
| **`anthropics/skills@webapp-testing`** | **200K+ installs** (Official Anthropic) | Full-stack web application TDD and E2E verification patterns | `npx skills add anthropics/skills@webapp-testing -g -y` |
| **`fastapi/fastapi@fastapi`** | **14.9K+ installs** (Official FastAPI) | Official FastAPI async routing, Pydantic v2 validation, and dependency injection best practices | `npx skills add fastapi/fastapi@fastapi -g -y` |

---

## 9. Iterative Implementation Roadmap (Agile Scrum Sprints)

### Sprint 0: Project Scaffolding, Hardened Docker Compose & TDD Harness
- Initialize `backend/` (FastAPI, SQLAlchemy, GeoAlchemy2, Alembic, Redis, httpx, pytest) and `frontend/` (React, TypeScript, Vite, CesiumJS, Vitest, Playwright).
- Create hardened `docker-compose.yml` (`db`, `redis`, `backend`, `worker`, `frontend`, plus `backend-test` and `e2e-test` profiles) and `.env` / `.env.example`.

### Sprint 1: Automated EONET v3 Ingestion & PostGIS Storage (`FR-01`–`FR-03`)
- **TDD First:** Write unit tests for `normalizer.py` and contract/integration tests for `eonet.py` and `observation` idempotent upserts.
- Implement Alembic migration for `event`, `observation`, and `sync_run`.
- Build the 10-minute background worker job to ingest open and recent closed EONET events.

### Sprint 2: PostGIS Country Matching & REST Countries Profiling (`FR-07`–`FR-09`)
- **TDD First:** Write unit tests for population density edge cases (`area=0`, `area=None`, rounding) and integration tests for `ST_Intersects`, coastal `ST_DWithin`, and `iso_a3 != '-99'` filtering.
- Load Natural Earth Admin 0 (1:10m) boundaries into `country_boundary` and build `rest_countries.py` adapter + `country_profile` caching.

### Sprint 3: Rule-Based NewsAPI Scoring, Deduplication & Redis Caching (`FR-10`–`FR-12`, `FR-14`)
- **TDD First:** Write unit tests for canonical URL deduplication and `scorer.py` (`algorithm_version 1`), plus quota-limit tests (`90` req/day cap) and keyless fallback.
- Implement `newsapi.py` adapter, `article` and `article_match` persistence, and Redis snapshot caching.

### Sprint 4: FastAPI Read Gateway, Minimalist React/CesiumJS UI (with Lite Mode) & E2E Verification (`FR-04`–`FR-06`, `FR-15`, `NFR-01`–`NFR-10`)
- **TDD First:** Write integration tests for `/api/v1/events`, `/api/v1/events/{id}`, `/api/v1/events/{id}/articles`, and `/api/v1/health`, plus Vitest component tests.
- Build the minimalist React + CesiumJS 3D globe (with on-demand rendering + 1-click Lite Mode toggle), keyboard-accessible sidebar list, detail drawer, country cards, news match badges, and mandatory data uncertainty disclaimers.
- Run the Playwright E2E suite (`exploration.spec.ts`, `accessibility.spec.ts`, `resilience.spec.ts`) and 2,000-event `< 2s` benchmark.

