# Product Specification: Earth Event & Disaster Monitoring System (`earth-emds`)

## 1. Product Overview

**Earth Event & Disaster Monitoring System** is an integrated, open-access educational and situational monitoring web application that connects live satellite-derived natural hazard feeds, administrative country boundaries, national demographic indicators, and curated news reporting on an interactive 3D virtual globe and keyboard-accessible list interface.

- **Project Team:** Ethan Campomanes, Michaela RJ Kate Endino, Jopur Jay Montecillo, Yuri Salise, Kurt Vincent Velasco
- **Program / Course:** Bachelor of Science in Information Technology — Systems Integration and Architecture (October 2026)

> **Use Boundary:** This platform is strictly an informational monitoring and educational learning system. It is **not** an emergency alerting, disaster prediction, casualty estimation, evacuation routing, or incident command service.

---

## 2. Problem Statement & Research Gaps Addressed

Global and municipal disaster information is fragmented across isolated platforms with incompatible formats and strict reporting thresholds:

1. **Disconnected Data Modalities:** Scientific satellite feeds (NASA EONET v3) provide live hazard coordinates (points, lines, polygons) without country codes, demographic context, or human-impact news. News aggregators (NewsAPI v2) search by text and date rather than GPS coordinates, while demographic services (REST Countries v3.1) provide macro-level national totals without spatial hazard intersection.
2. **Opaque ("Black-Box") AI Matching:** Existing news-to-hazard linking pipelines often rely on opaque NLP/LLM classifiers that fail to explain why an article was linked to an event or where location uncertainty exists.
3. **Visualization & Accessibility Trade-Offs:** Flat 2D web maps degrade under heavy multi-layer shapefiles on the client, whereas high-end 3D/VR systems require specialized hardware and lack keyboard-accessible alternatives.
4. **Fragile Live Connections & Uncommunicated Data Uncertainty:** Direct reliance on third-party APIs exposes platforms to rate limits (e.g., NewsAPI Developer plan limits and 24-hour article delays) and outages, while dashboards rarely label coordinate approximations, text-matched news caveats, or national-vs-local population density limits.

---

## 3. Product Goals & Non-Goals

### 3.1 Goals
- **Unified Multi-Source Monitoring:** Automatically ingest open and recent closed natural events (wildfires, severe storms, volcanoes, floods, sea and lake ice) from **NASA EONET v3** every 10 minutes without losing coordinate history or creating duplicates.
- **Server-Side Spatial Country Resolution & Profiling:** Match event geometries (`Point`, `LineString`, `Polygon`) against a local **Natural Earth Admin 0 (1:10m)** boundary dataset in **PostgreSQL/PostGIS** (`ST_Intersects` and coastal proximity `ST_DWithin`), enrich matched ISO codes via **REST Countries v3.1**, and compute indicative national population density ($\text{population} \div \text{area in km}^2$, rounded to the nearest integer).
- **Transparent, Rule-Based News Discovery:** Query **NewsAPI v2** (`/v2/everything`), deduplicate canonical URLs, and rank candidate articles using an explainable rule-based scoring rubric (`algorithm_version 1`) that displays human-readable match reasons in the UI.
- **Fast 3D Globe & Accessible List Exploration:** Render up to 2,000 events on a **React + TypeScript + CesiumJS** 3D globe paired with a synchronized, keyboard-operable sidebar list supporting filters by category, status (`open`/`closed`), date range, and map viewport bounding box in **under 2 seconds (p95)**.
- **Resilience & Honest Data Attribution:** Serve cached snapshots from **Redis** and **PostgreSQL** with explicit `last_updated` timestamps during upstream outages or rate-limit exhaustion, and display prominent UI disclaimers for satellite geometry approximations, text-based news matching, and national-scale population density.

### 3.2 Non-Goals
- Does **not** issue emergency alerts, predict hazards, count casualties, or guide evacuations.
- Does **not** claim news articles are geographically inside an event footprint (matches are contextual via text and publication window).
- Does **not** compute local disaster-zone population exposure from national population totals.
- Does **not** require user accounts/login, republish full copyrighted article text, or expose third-party API keys to the browser.

---

## 4. Target Users & Personas

| User Role | Needs & Primary Tasks |
| :--- | :--- |
| **Students & Educators** | Spin the 3D globe or browse the accessible list to study Earth science, geography, and IT integration; see how wildfires, storms, and volcanoes relate to countries and news coverage. |
| **Academic Researchers** | Inspect active/recent events alongside provenance links, observation histories, sync timestamps, and explicit news match evidence. |
| **Journalists & Media** | Track ongoing global hazards, verify official NASA source URLs, check baseline country context, and review related press coverage. |
| **General Public** | Explore global natural events on desktop or mobile without complex GIS software or account registration, guided by clear data-uncertainty labels. |
| **System Administrators / Developers** | Configure Docker Compose services, manage server-side `.env` keys, load Natural Earth Admin 0 boundaries, monitor sync health (`sync_run`), and tune NewsAPI quota budgets. |

---

## 5. User Journeys

### 5.1 Primary User Journey
1. **Landing & Overview:** User opens the web client and sees current open events plotted on the CesiumJS 3D globe and listed in the accessible sidebar, grouped/colored by category with a visible `last_updated` freshness indicator.
2. **Filtering & Viewport Search:** User filters by hazard category, date range, status (`open` or `closed`), text search, or current 3D globe camera bounding box. The client queries `/api/v1/events` and updates both globe geometries and list items in `< 2s`.
3. **Inspecting Event Details & Caveats:** User clicks a marker/polygon on the globe or selects an event via keyboard in the list. The detail drawer displays EONET title, category, status, observation coordinate history, magnitude (if present), official NASA source links, and a **Coordinate Approximation Disclaimer**.
4. **Viewing Country Context:** The detail drawer renders matched Country Profile Cards (official name, ISO codes, currency, population, land area in $\text{km}^2$, derived national population density, and `as_of` retrieval timestamp) accompanied by a **National Population Density Disclaimer**.
5. **Reviewing Scored News Coverage:** The article panel displays ranked candidate news articles (headline, publisher, publication timestamp, score badge, and human-readable match reasons such as `Category keyword + Country name + Published within 48h`) with a **Contextual News Match Disclaimer**. Clicking an article opens the original publisher URL in a new tab (`rel="noopener noreferrer"`).

### 5.2 Secondary & Edge-Case Journeys
- **Keyboard-Only / Low-Spec Exploration:** User navigates search filters, event list items, and detail tabs entirely via keyboard (`Tab`, `Enter`, `Arrow` keys) without manipulating the WebGL globe.
- **Offshore / Unmatched Country Events:** User opens an open-ocean event outside coastal buffer thresholds or in an unresolved territory (`iso_a3 = '-99'`); the UI cleanly states no country profile applies while still rendering full NASA EONET data.
- **Upstream Provider Outage / Rate-Limit Fallback:** User explores an event while NASA EONET, REST Countries, or NewsAPI is unreachable or HTTP `429` rate-limited; the system serves cached PostgreSQL/Redis snapshots with a visible banner indicating cached data age and last successful sync time.

---

## 6. Functional Requirements

| ID | Priority | Requirement Description |
| :--- | :---: | :--- |
| **FR-01** | Must | Automatically poll NASA EONET v3 every 10 minutes for open events and configured recent closed events. |
| **FR-02** | Must | Normalize stable event IDs, clean whitespace in titles, store missing magnitudes strictly as `null`, and preserve official source URLs. |
| **FR-03** | Must | Support `Point`, `LineString`, and `Polygon` geometries (WGS 84 / `EPSG:4326`) across multiple dated observations via idempotent upserts without losing movement history or creating duplicates. |
| **FR-04** | Must | Render color-coded markers, storm track lines, and hazard polygons on an interactive CesiumJS 3D globe alongside a synchronized, keyboard-accessible list view. |
| **FR-05** | Must | Filter events by category, status (`open`/`closed`), date window, text query, and map viewport bounding box (`bbox`), returning deterministic paginated results. |
| **FR-06** | Must | Display event title, category, observation dates, status, magnitude, official sources, and explicit geometry approximation caveats. |
| **FR-07** | Must | Resolve event geometries to zero or more ISO country codes using local Natural Earth Admin 0 (1:10m) boundaries in PostGIS (`ST_Intersects` + coastal `ST_DWithin` buffer), omitting invalid `iso_a3 = '-99'` features. |
| **FR-08** | Must | Fetch and cache country profiles (`name`, `cca2`, `cca3`, `population`, `area`, `currencies`) from REST Countries v3.1 (`/alpha`). |
| **FR-09** | Must | Calculate national population density as $\text{round}(\text{population} \div \text{area})$ in $\text{km}^2$ (returning `null` if area is zero or missing) and label it strictly as a national average. |
| **FR-10** | Must | Query NewsAPI v2 (`/v2/everything`) asynchronously using event keywords, place/country terms, language (`en`), and publication date window within daily Developer plan limits (enrich on discovery and at closure). |
| **FR-11** | Must | Rank candidate articles using transparent rule-based evidence (`algorithm_version 1`) and return numerical scores plus human-readable match reasons. |
| **FR-12** | Must | Serve cached events, country profiles, and articles from Redis/PostgreSQL with explicit freshness timestamps whenever an upstream API slows down, fails, or hits rate limits. |
| **FR-13** | Should | Expose provider health, cache freshness, and sync run status (`/api/v1/health`) without disclosing secrets. |
| **FR-14** | Must | Deduplicate events by provider ID and news articles by canonical URL (stripping tracking query parameters such as `?utm_source`, `?utm_medium`, `?fbclid`). |
| **FR-15** | Must | Open external NASA and news publisher links in a new browser tab (`target="_blank" rel="noopener noreferrer"`) without storing or republishing full copyrighted article bodies. |

---

## 7. Non-Functional & Quality Requirements

| ID | Category | Acceptance Target |
| :--- | :--- | :--- |
| **NFR-01** | **Performance** | Warm database/cache queries filtering up to 2,000 events by category, status, date range, or viewport `bbox` must return in **< 2 seconds (p95)**. |
| **NFR-02** | **Freshness** | Under normal upstream availability, newly published EONET updates appear within 15 minutes (10-minute polling cycle) with visible source and sync timestamps. |
| **NFR-03** | **Reliability & Resilience** | Any upstream API timeout, HTTP `5xx`, or HTTP `429` must never erase the last valid snapshot; stored events, countries, and articles continue rendering seamlessly. |
| **NFR-04** | **Security** | Third-party API keys (`NEWSAPI_KEY`) and DB credentials stay strictly in server-side `.env` variables; public FastAPI endpoints are read-only (`GET`), Pydantic-validated, CORS-restricted, and isolated from internal PostGIS (`5432`) and Redis (`6379`) Docker networks. |
| **NFR-05** | **Data Integrity** | All geometries enforce WGS 84 `[longitude, latitude]` (`EPSG:4326`, RFC 7946) with database constraints rejecting invalid coordinates or empty identifiers. |
| **NFR-06** | **Accessibility** | Core browsing, filtering, and event selection are 100% keyboard-operable; color is never the sole indicator of hazard category or status; all controls carry ARIA/accessible labels. |
| **NFR-07** | **Maintainability & TDD** | Each external provider has an isolated backend adapter covered by contract tests; all domain rules (normalization, density math, news scoring, spatial joins) follow Test-Driven Development (TDD) and End-to-End (E2E) verification. |
| **NFR-08** | **Observability** | Every background synchronization logs a `sync_run` record (provider, start/end timestamps, outcome, record counts, error class) and updates Redis quota/freshness keys. |
| **NFR-09** | **Cost & Quota Control** | NewsAPI enrichment is deduplicated, cached, and budgeted (e.g., max 90 requests/day with a 10-request reserve on the 100 req/day Developer tier, enriching once on discovery and once on closure). |
| **NFR-10** | **Transparency & Interpretability** | Every matched article displays its scoring evidence; every country card shows provider and retrieval time; UI disclaimers are persistently visible on event, country, and news views. |

---

## 8. Modern Minimalistic UI/UX & Low-Spec Performance Design

### 8.1 Modern & Minimalistic Aesthetic
- **Clean Command-Center Layout:** Full-viewport canvas with floating, translucent glassmorphic panels (`backdrop-filter: blur(12px)`), subtle `1px` borders, high-contrast typography (`Inter` / system sans-serif + `JetBrains Mono` for coordinates/timestamps), and zero visual clutter.
- **Progressive Disclosure:** The main screen displays only essential controls—a compact top/left filter bar, a clean keyboard-navigable event list, and the 3D globe. Clicking an event smoothly slides open the contextual Detail Drawer (Event Metadata, Country Profile Card, and Ranked News Coverage).
- **Accessible Color & Icon System:** Distinct, colorblind-safe hazard badges (Wildfires, Severe Storms, Volcanoes, Floods, Sea/Lake Ice) paired with unique SVG icons so color is never the only visual signal (`NFR-06`).

### 8.2 Handling Heavy 3D Rendering ("Lite Mode" & Low-Spec Device Optimization)
Because WebGL 3D globes (CesiumJS) can be heavy on laptops with integrated GPUs or limited RAM:
- **On-Demand Rendering (`requestRenderMode: true`):** CesiumJS only renders a new WebGL frame when the user pans/zooms the camera or when filtered data changes—reducing idle GPU/CPU usage by ~90%.
- **Lightweight Scene Defaults:** Expensive post-processing effects (shadows, bloom, dynamic atmosphere lighting, 3D buildings, high-DPI supersampling) are disabled by default. Dense point observations are clustered automatically.
- **1-Click "Lite Mode" (2D/List Performance Toggle) & Auto-Fallback:** A header toggle allows users on lower-powered devices to pause/hide the 3D WebGL canvas at any time and use the ultra-fast, minimalist list-and-drawer workspace. If WebGL initialization fails or frame rates drop critically, the UI automatically falls back to Lite Mode without interrupting exploration.

---

## 9. Mandatory User Interface Disclaimers

To prevent misinterpretation of scientific, demographic, and media data, the UI must display three explicit notices:

1. **Satellite Geometry Caveat:** *"Event coordinates and perimeters from NASA EONET v3 are approximate satellite/agency observations and may reflect upstream reporting delays. Do not use for local emergency navigation."*
2. **National Population Density Caveat:** *"Population density is a national macro-level average calculated from REST Countries v3.1 (National Population ÷ Total Land Area in km²) and does not measure local population exposure inside the hazard footprint."*
3. **Contextual News Matching Caveat:** *"News articles from NewsAPI v2 are matched contextually by hazard keywords, country/place names, and publication dates—not by verified GPS coordinates inside the disaster area."*

