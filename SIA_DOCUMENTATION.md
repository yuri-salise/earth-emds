# Earth Event & Disaster Monitoring System (`earth-emds`)
## System Architecture and Integration Documentation
**A Course-Ready Architecture & Integration Specification for a Live 3D Globe Connecting Earth Events with Regional Reporting and Country Context**

---

### Document Control & Metadata

| Field | Detail |
| :--- | :--- |
| **Project Title** | Earth Event & Disaster Monitoring System (`earth-emds`) |
| **Document Type** | System Architecture and Integration (SIA) Documentation |
| **Document Version** | **2.0 (Harmonized & Production-Verified)** |
| **Previous Version** | 1.0 (Draft dated 15 October 2026) |
| **Date of Revision** | November 2026 |
| **Academic Program** | Bachelor of Science in Information Technology |
| **Course** | Systems Integration and Architecture (SIA) |
| **Project Authors** | Ethan Campomanes, Michaela RJ Kate Endino, Jopur Jay Montecillo, Yuri Salise, Kurt Vincent Velasco |
| **Repository** | `earth-emds` |
| **System Status** | Verified Containerized Production Architecture |

> **Operational & Ethical Boundary:**  
> This platform is strictly an **informational monitoring and educational learning system**. It is **not** an emergency alerting, disaster prediction, casualty estimation, evacuation routing, or incident command platform. Event geometries are approximate satellite observations, news matches are contextual text associations, and demographic density figures represent national-level macro averages rather than local disaster zone exposure.

---

## Inconsistency Audit & Harmonization Matrix

This section explicitly documents the discrepancies identified between **Chapters I through IV of the Academic Manuscript**, the **Draft SIA Documentation (v1.0)**, and the **Actual Project Implementation**, along with their authoritative resolutions in this v2.0 document.

| Discrepancy Area | Chapters I–IV (Manuscript) | Draft SIA Documentation (v1.0 PDF) | Actual Codebase & Architecture | Authoritative Resolution in v2.0 |
| :--- | :--- | :--- | :--- | :--- |
| **1. Project Title** | "Earth Event & Disaster Monitoring System" | "Earth Event and Disaster Monitor" | `earth-emds` / "Earth Event & Disaster Monitoring System" | Standardized across all documents as **Earth Event & Disaster Monitoring System (`earth-emds`)**. |
| **2. Author Attribution** | Names 5 group members (Campomanes, Endino, Montecillo, Salise, Velasco) | Omitted author names (referred only to "student team") | Configured in `product.md` and repo metadata | Explicitly credited to the 5 BSIT student authors in Document Metadata. |
| **3. REST Countries API Version** | Consistently cites **v3.1** across all chapters | Figure 1 (p. 7) erroneously labeled **"REST Countries v5"**; Section 7.3 cited v3.1 | `https://restcountries.com/v3.1/alpha` | Corrected Figure 1 and all architectural diagrams to **REST Countries v3.1**; eliminated nonexistent "v5" label. |
| **4. Background Ingestion Worker** | Chapter 3 (p. 2) and Chapter 4 (Table 2) specify a dedicated Python async worker | Section 6.1 recommended "Celery with Redis, or one scheduler and worker for MVP" | Async Python worker (`python -m app.worker`) via `asyncio` & `httpx` in Docker Compose | Standardized on **Async Python Background Worker**; removed obsolete Celery dependency references. |
| **5. Functional Requirements (FR)** | Chapter 3 (Section 2.1) consolidated requirements into **8** broad items | Section 4.1 defined **15** granular items (`FR-01` to `FR-15`) | Codebase implements all 15 granular requirements | Retained the 15-item traceability matrix (`FR-01` through `FR-15`) and mapped each directly to Chapter 3's 8 requirements. |
| **6. Non-Functional Requirements (NFR)** | Chapter 3 (Section 2.2) listed **5** grouped quality requirements | Section 4.2 listed **10** granular quality requirements (`NFR-01` to `NFR-10`) | Validated via TDD unit tests, Playwright E2E, and Docker healthchecks | Retained all 10 granular quality standards (`NFR-01` through `NFR-10`) mapped to Chapter 3's 5 quality categories. |
| **7. API Endpoint Paths** | Chapter 4 (p. 6, Step 4) had typo `/api/v1/events/{id}/ details` | Section 8.4 listed `/api/v1/events`, `/api/v1/events/{id}`, and `/api/v1/events/{id}/articles` | `main.py` provides `/events`, `/events/{event_id}`, `/events/{event_id}/articles`, `/health`, `/sync` | Corrected endpoint signature to `GET /api/v1/events/{id}`; documented full endpoint catalog including `GET /api/v1/health` and `POST /api/v1/sync`. |
| **8. Health & Observability Endpoint** | Required by FR-13 / NFR-08; omitted in Chapter 3/4 text | Omitted in Section 8.4 endpoint table | `GET /api/v1/health` implemented with cache freshness, quota status, and disclaimers | Added `GET /api/v1/health` to Section 8.4 endpoint catalog and Docker healthcheck specification. |
| **9. Database Schema Scope** | Chapter 4 describes tables for events, geometries, countries, event-country links, and scored news | Section 8.3 showed an incomplete 2-table schema (`event`, `observation`) | Full 8-table PostGIS/SQLite normalized spatial schema in `init_postgis.sql` & `db.py` | Fully specified all **8 physical tables**: `country_boundary`, `country_profile`, `event`, `observation`, `event_country`, `article`, `article_match`, and `sync_run`. |
| **10. Rule-Based Scoring Weights** | Described conceptually in Chapters 2, 3, and 4 | Mentioned 85% precision on 50 articles, but omitted numerical weights | `scorer.py` implements: Title +35, Category +25, Country +25, Date window +15 | Formally documented the exact transparent scoring rubric (+35, +25, +25, +15, thresholds: $\ge 70$ Strong, $45\text{--}69$ Moderate, $25\text{--}44$ Weak). |
| **11. News Matching Time Window** | Chapter 3 gave example "within 48 hours" | Section 9.4 cited "testing 24-hour delays" | `scorer.py` defaults to `window_days = 7.0` (±7 days) to accommodate free tier delays | Clarified that the date proximity rule awards points for articles within the active event window (default ±7 days, with ±48–72h for strict filters). |
| **12. Population Density Formula Typo** | Chapter 4 (p. 5) had typographical error: "density population land area" (missing division) | Section 4.1 & 9.7 correctly defined $\text{population} \div \text{area}$ | Guarded division: `None` if area $\le 0$, else $\text{round}(\text{pop} \div \text{area})$ | Formally documented guarded formula: $\text{round}(\text{population} \div \text{area}_{\text{km}^2})$ with zero/null checks. |
| **13. Document Completeness** | Manuscript contains complete Chapters I through IV | Draft SIA PDF truncated at Section 9.7 (missing Sections 10 to 17) | Complete repository documentation and working test harness | Reconstructed and fully articulated all missing sections (**Sections 10 through 17**). |
| **14. Frontend Port Mapping** | Chapter 4 Table 2 cited "Port 80/443 or 3000" | Section 5.2 / Table 6 cited generic ports | Nginx listens internally on `8080`, mapped to host port `3000:8080` in Compose | Formally documented container port mappings: Frontend `3000:8080`, Backend `8000:8000`, DB `5432` (internal), Redis `6379` (internal). |
| **15. Country Boundary Asset Format** | Chapter 4 mentioned "shapefile import" | Section 7.4 cited "Natural Earth Admin 0 at 1:10m" | Pre-processed GeoJSON `ne_admin0_countries.json` loaded into PostGIS | Documented streamlined deployment: Admin 0 polygons loaded via structured GeoJSON avoiding external GDAL CLI dependencies at container boot. |

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [System Definition](#2-system-definition)
3. [Scope and User Journeys](#3-scope-and-user-journeys)
4. [Requirements Engineering](#4-requirements-engineering)
5. [Architecture Overview & Topology](#5-architecture-overview--topology)
6. [Component Design & Technology Selection](#6-component-design--technology-selection)
7. [External Integration Specifications](#7-external-integration-specifications)
8. [Data Model & Internal API Contract](#8-data-model--internal-api-contract)
9. [Data Processing, Matching & Demographic Pipelines](#9-data-processing-matching--demographic-pipelines)
10. [Security & Responsible Presentation](#10-security--responsible-presentation)
11. [Reliability, Resilience & Fallback Operations](#11-reliability-resilience--fallback-operations)
12. [Deployment & Container Delivery](#12-deployment--container-delivery)
13. [Verification & Testing Strategy](#13-verification--testing-strategy)
14. [Implementation Roadmap & Agile Sprints](#14-implementation-roadmap--agile-sprints)
15. [Architecture Decision Records (ADRs) & Risk Management](#15-architecture-decision-records-adrs--risk-management)
16. [Glossary & Acronyms](#16-glossary--acronyms)
17. [References](#17-references)

---

## 1. Executive Summary

The **Earth Event & Disaster Monitoring System (`earth-emds`)** provides a unified, open-access web application for exploring global natural hazard events on an interactive 3D virtual globe paired with a synchronized, keyboard-accessible list interface. It enriches raw physical hazard observations with sovereign country demographic indicators and transparently ranked journalistic coverage while strictly preserving source attribution and declaring data limitations.

The production release integrates:
- A responsive client tier built with **React 18**, **TypeScript**, **CesiumJS**, and **Vite**, featuring an on-demand rendering loop and a 1-click **Lite Mode** for low-spec laptops.
- A high-performance application gateway built with **Python 3.11+**, **FastAPI**, and **Pydantic v2**, enforcing read-only access and schema validation.
- A dedicated **Scheduled Background Ingestion Worker** operating on a 10-minute cadence to poll feeds, compute spatial intersections, and manage API rate limits.
- A spatial persistent store combining **PostgreSQL 16** with the **PostGIS 3.4** extension (with SQLite WAL support for lightweight standalone testing).
- An in-memory cache and rate-limit coordinator using **Redis 7**.

The system ingests scientific metadata from **NASA EONET v3** (wildfires, severe storms, volcanoes, floods, sea/lake ice), maps coordinates to sovereign countries using a local **Natural Earth Admin 0 (1:10m)** boundary dataset, retrieves country demographic indicators from **REST Countries v3.1**, and links candidate articles from **NewsAPI v2** (with keyless fallback to Google News RSS and UN OCHA ReliefWeb). 

To ensure responsible presentation:
1. Coordinate approximations are clearly labeled so satellite perimeters are not mistaken for ground-zero evacuation perimeters.
2. Candidate articles are ranked using an explainable rule-based scoring algorithm (`algorithm_version 1`) displaying explicit match evidence.
3. Country population density is calculated with strict zero/null division guards and labeled as a macro-level national indicator rather than local disaster exposure.

---

## 2. System Definition

### 2.1 Purpose and Intended Users
The system provides educational institutions, researchers, journalists, and citizens with an intuitive, integrated tool to monitor where Earth events occur and how media outlets report them, without requiring specialized desktop GIS installations or user account registration.

### 2.2 System Goals
- **Unified Hazard Visualization:** Display open and recent closed natural hazards on an interactive 3D CesiumJS globe with color-coded categories and vector geometry footprints (`Point`, `LineString`, `Polygon`).
- **Interactive Multi-Parametric Filtering:** Enable filtering by hazard category, date range, status (`open` or `closed`), text search, and map camera bounding box (`bbox`), returning results in **under 2 seconds (p95)** for up to 2,000 events.
- **Server-Side Spatial Country Profiling:** Match event coordinates against national boundaries in PostGIS and display enriched country context (name, ISO codes, population, area, currency, and calculated national population density).
- **Explainable News Association:** Search and rank relevant journalistic coverage within strict daily API budgets, displaying plain-language match reasons for every score.
- **Transparent Data Provenance:** Prominently render last-updated timestamps, data caveats, and provider attribution across all UI components.

### 2.3 Non-Goals
- **No Emergency Warning or Dispatch:** The system does not issue sirens, push notifications, evacuation orders, casualty predictions, or damage assessments.
- **No Geolocation Claim for News:** The system does not assert that news reporters or publishers were physically situated inside the hazard geometry.
- **No Local Vulnerability Modeling:** The system does not extrapolate micro-level neighborhood casualties from gross national demographic totals.
- **No Content Piracy:** The system does not scrape or store full copyrighted news articles; only titles, snippets, and outbound links are stored.
- **No Account Gating:** The system does not require user registration, passwords, or personal profiles.

### 2.4 Constraints and Assumptions
- **Academic & Public Scope:** Designed for undergraduate computer science / information technology evaluation and public demonstrations.
- **Free-Tier Operational Feasibility:** Operates entirely within free service tiers: NASA EONET (free, keyless), Natural Earth (public domain), REST Countries v3.1 (free, keyless), and NewsAPI v2 (Developer free tier: 100 req/day, 24-hour article delay).
- **Client Diversity:** Optimized for standard desktop browsers with an automatic or manual fallback to **Lite Mode** for machines lacking dedicated GPU hardware.

---

## 3. Scope and User Journeys

### 3.1 Primary User Journey
```mermaid
sequenceDiagram
    autonumber
    actor User as Public Explorer
    participant Client as React + CesiumJS UI
    participant API as FastAPI Gateway
    participant Cache as Redis Cache
    participant DB as PostGIS / DB
    participant Pub as News Publisher

    User->>Client: Opens web client / adjusts category or viewport filter
    Client->>API: GET /api/v1/events?category=wildfires&bbox=...
    API->>Cache: Check filter cache signature
    alt Cache Hit
        Cache-->>API: Return cached GeoJSON payload (<5ms)
    else Cache Miss
        API->>DB: Query events & spatial geometries within bbox
        DB-->>API: Return normalized records (<50ms)
        API->>Cache: Populate Redis with 60s TTL
    end
    API-->>Client: Normalized GeoJSON payload + Caveats (<2s p95)
    Client-->>User: Renders 3D globe markers & updates accessible sidebar list
    
    User->>Client: Selects specific hazard event
    Client->>API: GET /api/v1/events/{id}
    API->>DB: Fetch event metadata, observation history & country profile
    DB-->>API: Return complete event detail
    API-->>Client: Event detail + Country profile + Disclaimers
    
    Client->>API: GET /api/v1/events/{id}/articles
    API->>DB: Fetch ranked candidate articles & match evidence
    DB-->>API: Return scored articles (algorithm_version 1)
    API-->>Client: Article list + score badges + match reasons
    Client-->>User: Displays detail drawer with Country Card & News List
    
    User->>Pub: Clicks article headline (opens in new tab with rel="noopener noreferrer")
```

### 3.2 Secondary Journeys & Edge Cases
1. **Keyboard-Only Navigation:** Users navigating via `Tab`, `Arrow` keys, and `Enter` can filter, search, expand events, and inspect articles without touching the 3D canvas.
2. **Offshore / Ocean Hazards:** For deep-ocean storms outside national territorial waters and coastal proximity buffers (100 km), the system cleanly states *"Open Ocean / International Waters — No sovereign country boundary match"* while preserving full hazard coordinates.
3. **Disputed Territories (`iso_a3 = '-99'`):** Features returning `-99` in Natural Earth (such as Somaliland) are handled safely without generating failing REST Countries calls.
4. **Upstream API Outages:** If NASA EONET or NewsAPI is unreachable, the UI continues serving the latest valid database snapshot and displays a visible amber `FreshnessBanner` showing the exact age of cached data.

---

## 4. Requirements Engineering

### 4.1 Functional Requirements Matrix (FR-01 to FR-15)

The 15 functional requirements map directly to Chapter 1's specific objectives and Chapter 3's core system modules:

| Requirement ID | Priority | Requirement Description | Target Module | Cross-Ref (Chapter 3 / 1) |
| :--- | :---: | :--- | :--- | :--- |
| **FR-01** | **Must** | Automatically poll NASA EONET v3 every 10 minutes for open events and configured recent closed events. | Ingestion Worker | Module 1 / Objective ii.1 |
| **FR-02** | **Must** | Normalize stable event IDs, clean whitespace, store missing magnitudes strictly as `null`, and preserve source URLs. | Data Normalizer | Module 1 / Objective ii.1 |
| **FR-03** | **Must** | Ingest `Point`, `LineString`, and `Polygon` geometries (WGS 84 / `EPSG:4326`) across dated observations without losing coordinate history. | Ingestion Worker | Module 1 / Objective ii.1 |
| **FR-04** | **Must** | Render color-coded markers, storm tracks, and polygon perimeters on an interactive CesiumJS 3D globe alongside a synchronized sidebar list. | Frontend Client | Module 5 / Objective ii.4 |
| **FR-05** | **Must** | Filter events by category, status (`open`/`closed`), date window, text query, and camera bounding box (`bbox`), returning paginated results. | FastAPI Gateway | Module 5 / Objective ii.4 |
| **FR-06** | **Must** | Display event title, category, dates, status, magnitude, sources, and satellite coordinate approximation caveats in the detail drawer. | Frontend Client | Module 5 / Objective ii.4 |
| **FR-07** | **Must** | Resolve event geometries to zero or more ISO country codes using local Natural Earth Admin 0 boundaries (`ST_Intersects` and 100km coastal buffer). | Spatial Engine | Module 2 / Objective ii.2 |
| **FR-08** | **Must** | Fetch and cache country profiles (`name`, `cca2`, `cca3`, `population`, `area`, `currencies`) from REST Countries v3.1 (`/alpha`). | REST Countries Adapter | Module 2 / Objective ii.2 |
| **FR-09** | **Must** | Calculate national population density as $\text{round}(\text{population} \div \text{area}_{\text{km}^2})$ with zero/null area guards, labeled strictly as national average. | Demographics Service | Module 2 / Objective ii.2 |
| **FR-10** | **Must** | Search NewsAPI v2 (`/v2/everything`) using hazard keywords, location/country terms, language (`en`), and publication date window within daily quota. | NewsAPI Adapter | Module 3 / Objective ii.3 |
| **FR-11** | **Must** | Rank candidate news articles using transparent rule-based evidence (`algorithm_version 1`) returning numerical scores and human-readable match reasons. | News Scorer | Module 3 / Objective ii.3 |
| **FR-12** | **Must** | Serve cached data from Redis and PostGIS snapshots with visible freshness timestamps whenever an upstream provider is unavailable or rate-limited. | Caching & Backup | Module 4 / Objective ii.5 |
| **FR-13** | **Should**| Expose provider health, cache freshness, and sync run status (`/api/v1/health`) without disclosing secret API keys. | FastAPI Gateway | Module 4 / Objective ii.6 |
| **FR-14** | **Must** | Deduplicate events by provider ID and articles by canonicalized URL (stripping tracking query parameters like `?utm_source`). | Data Normalizer | Module 1 & 3 / Objective ii.1 & 3 |
| **FR-15** | **Must** | Allow users to open external scientific source links and news publisher URLs in new browser tabs (`target="_blank" rel="noopener noreferrer"`). | Frontend Client | Module 5 / Objective ii.6 |

---

### 4.2 Quality & Non-Functional Requirements Matrix (NFR-01 to NFR-10)

| ID | Quality Attribute | Acceptance Target | Thesis Mapping (Chapter 3) |
| :--- | :--- | :--- | :--- |
| **NFR-01** | **Performance** | For warm database queries filtering up to 2,000 events, p95 API response must be **under 2 seconds**. | Category 4: Performance & Response Time |
| **NFR-02** | **Freshness** | Newly published EONET events must be ingested within **15 minutes** of feed availability under normal network conditions. | Category 1: Availability & Resilience |
| **NFR-03** | **Reliability** | Upstream provider failures (HTTP 429/5xx/timeout) must never wipe valid database snapshots; system continues operating from cache. | Category 1: Availability & Resilience |
| **NFR-04** | **Security** | Secrets (`NEWSAPI_KEY`, database passwords) stay strictly server-side; public endpoints are read-only (`GET`); DB/Redis isolated in Docker bridge network. | Category 2: Security |
| **NFR-05** | **Data Integrity** | Geometries enforce WGS 84 coordinate order `[longitude, latitude]` (`EPSG:4326`, RFC 7946); database constraints reject malformed geometries or blank IDs. | Category 2: Security & Schema Validation |
| **NFR-06** | **Accessibility** | All core workflows (filtering, search, event selection, news inspection) are fully keyboard-operable (`Tab`, `Enter`, `Esc`); color is never the sole visual signal. | Category 3: Accessibility & Open Access |
| **NFR-07** | **Maintainability** | Upstream APIs are isolated behind dedicated backend adapters covered by unit/contract tests; upstream schemas never leak into public contracts. | Category 2: Modular Architecture |
| **NFR-08** | **Observability** | Every ingestion execution logs a `sync_run` record (provider, timestamps, outcome, records processed, error class); health endpoint exposes operational state. | Category 1: Availability & Resilience |
| **NFR-09** | **Cost & Quota** | NewsAPI daily requests are capped at 90/day (preserving a 10-request reserve on the 100 req/day free Developer plan); enrichment occurs once on open and once on close. | Category 1: Rate Limit Resilience |
| **NFR-10** | **Interpretability** | Every news match exposes its scoring criteria; every country card displays provider and retrieval timestamp; all 3 mandatory data disclaimers are visible. | Category 5: Data Transparency |

---

## 5. Architecture Overview & Topology

### 5.1 Modular Logical Architecture
The architecture is structured as a **decoupled modular system** separating interactive user queries from asynchronous ingestion and enrichment pipelines:

```mermaid
graph TD
    subgraph Client Tier ["Client Presentation Tier (Browser)"]
        UI["React 18 + TypeScript Client"]
        Globe["CesiumJS 3D Virtual Globe"]
        List["Keyboard-Accessible Sidebar List"]
        Drawer["Detail Drawer & Disclaimers"]
        Lite["1-Click Lite Mode (2D View)"]
    end

    subgraph Gateway Tier ["Application Gateway Tier (FastAPI)"]
        API["FastAPI Backend Server (:8000)"]
        Sec["Security & Rate-Limit Middleware"]
        Pyd["Pydantic v2 Schema Validation"]
    end

    subgraph Worker Tier ["Background Ingestion Tier (Worker)"]
        Worker["Async Python Ingestion Worker"]
        Sched["10-Minute Polling Loop"]
        Quota["Redis NewsAPI Quota Guard (90/day)"]
    end

    subgraph Storage Tier ["Data & Caching Tier (Docker Network)"]
        PostGIS[("PostgreSQL 16 + PostGIS 3.4 (:5432)")]
        Redis[("Redis 7 Cache & Job Store (:6379)")]
    end

    subgraph External Tier ["External Data Authorities & Providers"]
        EONET["NASA EONET v3 API (Free, Keyless)"]
        NatEarth["Natural Earth Admin 0 1:10m (Local GeoJSON)"]
        RestCountries["REST Countries v3.1 API (Free, Keyless)"]
        NewsAPI["NewsAPI v2 /everything (Free Tier, Keyed)"]
        Fallbacks["Google News RSS / ReliefWeb / NASA EO"]
    end

    UI --> API
    Globe -.-> UI
    List -.-> UI
    Drawer -.-> UI
    Lite -.-> UI

    API --> Sec
    Sec --> Pyd
    Pyd --> Redis
    Pyd --> PostGIS

    Worker --> Sched
    Sched --> EONET
    Sched --> NatEarth
    Sched --> RestCountries
    Sched --> Quota
    Quota --> NewsAPI
    Quota -.-> Fallbacks

    Worker --> PostGIS
    Worker --> Redis
```

### 5.2 Containerized Deployment Topology (Docker Compose)
The five services run in isolated containers connected across two dedicated bridge networks (`frontend_net` and `backend_net`):

```mermaid
graph LR
    subgraph Host ["Host Machine (Local Dev / Staging)"]
        Port3000["Host Port 3000"]
        Port8000["Host Port 8000"]
    end

    subgraph FrontendNet ["frontend_net (Bridge)"]
        Frontend["earthemds-frontend<br/>Nginx 1.27 (:8080)<br/>Non-Root appuser"]
    end

    subgraph BackendNet ["backend_net (Internal Bridge)"]
        Backend["earthemds-backend<br/>FastAPI / Uvicorn (:8000)<br/>Non-Root appuser"]
        Worker["earthemds-worker<br/>Async Scheduler<br/>Non-Root appuser"]
        DB["earthemds-db<br/>PostGIS 16-3.4 (:5432)<br/>Named Volume: pgdata"]
        Redis["earthemds-redis<br/>Redis 7-alpine (:6379)<br/>Named Volume: redisdata"]
    end

    Port3000 -->|HTTP| Frontend
    Port8000 -->|HTTP REST| Backend
    Frontend -->|Reverse Proxy / Direct API| Backend
    Backend --> DB
    Backend --> Redis
    Worker --> DB
    Worker --> Redis
```

---

## 6. Component Design & Technology Selection

| Component Name | Tier | Technology Stack | Protocols & Ports | Role & Key Responsibilities |
| :--- | :--- | :--- | :--- | :--- |
| **Web Frontend Interface** | Presentation | React 18, TypeScript, CesiumJS, Vite, Tailwind/CSS3 | HTTP/HTTPS (Container port `8080`, Host port `3000`) | Renders 3D virtual globe, interactive filter controls, accessible list, country cards, scored news, and mandatory disclaimers. Supports on-demand rendering and Lite Mode toggle. |
| **Application API Gateway** | Gateway | Python 3.11+, FastAPI, Pydantic v2, Uvicorn | HTTP/HTTPS REST / JSON & GeoJSON (Port `8000`) | Validates query parameters (`bbox`, category, date range), enforces per-IP sliding window rate limiting, checks Redis cache, executes spatial reads against PostGIS, isolates server API keys. |
| **Scheduled Ingestion Worker** | Ingestion | Python 3.11+, `asyncio`, `httpx`, `defusedxml` | Outbound HTTPS (`443`); Internal DB TCP | Polls NASA EONET v3 every 10 minutes, normalizes GeoJSON coordinates, executes PostGIS spatial intersections, queries REST Countries v3.1, manages NewsAPI daily quotas, scores news, logs sync status. |
| **Spatial Database** | Persistent Storage | PostgreSQL 16 + PostGIS 3.4 (with SQLite WAL fallback) | PostgreSQL Wire Protocol (TCP Port `5432`) | Stores events, multi-observation geometries, country boundaries, country profiles, news articles, rule-based match evidence, and sync history. Maintains GiST spatial indexes. |
| **In-Memory Cache & Quota Store** | Caching & State | Redis 7 | Redis TCP Protocol (Port `6379`) | Caches API filter responses (60s TTL), holds fallback snapshots during outages, and maintains the daily NewsAPI request budget counter (`newsapi:quota:YYYY-MM-DD`). |
| **Country Boundary Dataset** | Spatial Reference | Natural Earth Admin 0 Countries (1:10m Scale) | Internal PostGIS SQL / GeoJSON | Provides sovereign national boundaries and ISO 3166-1 alpha-2/alpha-3 country codes for spatial containment and coastal proximity matching. |

---

## 7. External Integration Specifications

### 7.1 NASA EONET v3 (Earth Observatory Natural Event Tracker)
- **Base URL:** `https://eonet.gsfc.nasa.gov/api/v3`
- **Authentication:** None required (100% Free Public Scientific API).
- **Primary Endpoints:**
  - `GET /events?status=open`: Fetches all currently active global events.
  - `GET /events?status=closed&limit=100`: Fetches recently closed events for historical review.
  - `GET /categories`: Fetches official hazard taxonomies.
- **Polling Cadence:** Every 10 minutes (600 seconds), ensuring new events appear within 15 minutes of upstream publication (`NFR-02`).
- **Consumed Payload Structure:**
  - `id` (e.g. `"EONET_10524"`): Unique stable hazard identifier.
  - `title`: Natural event designation (cleaned of redundant whitespace).
  - `categories`: Array of objects (`id`, `title`).
  - `geometry`: Array of dated spatial observations with `date`, `type` (`Point`, `LineString`, `Polygon`), `coordinates` in GeoJSON `[lon, lat]` order, and optional `magnitudeValue` / `magnitudeUnit`.
  - `sources`: Scientific citation links (e.g., InciWeb, Volcano Discovery, JTWC).
- **Error Handling & Resilience:**
  - Connection timeout: 5.0 seconds. Bounded exponential backoff with jitter on HTTP `5xx` or network errors. Stored snapshots in PostGIS remain untouched if EONET fails.

### 7.2 NewsAPI v2
- **Base URL:** `https://newsapi.org/v2`
- **Authentication:** `X-Api-Key` HTTP Request Header (kept strictly server-side).
- **Primary Endpoint:** `GET /v2/everything`
- **Query Construction:**
  - `q`: Formed by concatenating cleaned event title keywords with the primary matched country name (e.g., `"Kilauea Volcano United States"`).
  - `searchIn`: `"title,description"`
  - `language`: `"en"`
  - `sortBy`: `"relevancy"`
  - `pageSize`: `15`
- **Daily Budget & Rate-Limit Strategy:**
  - The free Developer tier permits 100 requests/day with a 24-hour article publication delay.
  - Enforce a strict cap in Redis: `newsapi:quota:YYYY-MM-DD` limited to **90 requests/day**, reserving 10 requests for administrative testing.
  - Events are enriched only **once upon initial discovery** (`news_enriched_on_open = TRUE`) and **once upon closure** (`news_enriched_on_close = TRUE`).
- **Resilient Fallback Tier:**
  - When the daily budget is exhausted, `NEWSAPI_KEY` is not provided, or NewsAPI returns HTTP `429`, the worker seamlessly switches to keyless **Google News RSS** queries and curated high-signal disaster monitors (**UN OCHA ReliefWeb** and **NASA Earth Observatory**) with live working URLs.

### 7.3 REST Countries v3.1
- **Base URL:** `https://restcountries.com/v3.1`
- **Authentication:** None required (100% Free Public Demographic API).
- **Primary Endpoint:** `GET /alpha?codes={codes}&fields=name,cca2,cca3,population,area,currencies`
- **Batch Processing:** Matched ISO alpha-3 country codes from PostGIS are deduplicated and queried in batch.
- **Consumed Fields:** Official common name, ISO alpha-2/alpha-3 codes, total population, total land area in $\text{km}^2$, and national currencies.
- **Data Caveat Handling:** Territories with zero or missing area (e.g. coral reefs, uninhabited atolls) are trapped: `population_density` is set to `null` to bypass division by zero.

### 7.4 Natural Earth Admin 0 Country Boundaries
- **Dataset:** Natural Earth Admin 0 Countries at 1:10,000,000 scale (1:10m).
- **License:** Public Domain (no commercial or attribution restrictions).
- **Handling of Unofficial / Non-Standard Codes:** Polygons returning `iso_a3 = '-99'` (e.g., Somaliland) are excluded from downstream REST Countries queries to avoid HTTP `400` errors.
- **Coastal Buffer Proximity:** For offshore hazard points (such as marine cyclones or coastal eruptions), PostGIS executes `ST_DWithin(c.geom::geography, o.geom::geography, 100000)` (100 km coastal buffer) to associate the event with the nearest coastal nation.

---

## 8. Data Model & Internal API Contract

### 8.1 Physical Relational & Spatial Database Schema (PostGIS 3.4)

The database schema consists of **8 normalized tables**:

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Sovereign Country Boundaries (Natural Earth Admin 0 1:10m)
CREATE TABLE country_boundary (
    iso_a3 VARCHAR(3) PRIMARY KEY,
    iso_a2 VARCHAR(2),
    name VARCHAR(120) NOT NULL,
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
    dataset_version VARCHAR(32) NOT NULL DEFAULT 'ne_10m_admin_0_v5.1.1',
    CONSTRAINT chk_valid_iso_a3 CHECK (iso_a3 <> '-99' AND length(trim(iso_a3)) = 3)
);
CREATE INDEX idx_country_boundary_geom ON country_boundary USING GIST (geom);

-- 2. Country Demographic Profiles (REST Countries v3.1)
CREATE TABLE country_profile (
    iso_a3 VARCHAR(3) PRIMARY KEY REFERENCES country_boundary(iso_a3) ON DELETE CASCADE,
    iso_a2 VARCHAR(2),
    name VARCHAR(120) NOT NULL,
    population BIGINT CHECK (population IS NULL OR population >= 0),
    area_sq_km DOUBLE PRECISION CHECK (area_sq_km IS NULL OR area_sq_km >= 0),
    population_density INTEGER, -- round(population / area_sq_km) or NULL
    currencies JSONB NOT NULL DEFAULT '{}'::jsonb,
    retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Primary Hazard Events (NASA EONET v3)
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

-- 4. Spatial Observations & Time-Series Coordinates
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

-- 5. Event-to-Country Spatial Associations
CREATE TABLE event_country (
    event_id VARCHAR(64) NOT NULL REFERENCES event(id) ON DELETE CASCADE,
    iso_a3 VARCHAR(3) NOT NULL REFERENCES country_boundary(iso_a3) ON DELETE CASCADE,
    match_method VARCHAR(32) NOT NULL CHECK (match_method IN ('intersects', 'coastal_proximity')),
    PRIMARY KEY (event_id, iso_a3)
);
CREATE INDEX idx_event_country_iso ON event_country (iso_a3);

-- 6. Deduplicated News Articles (NewsAPI v2 / Fallback Feeds)
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

-- 8. Ingestion & Synchronization Run History (Observability)
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

### 8.2 Entity-Relationship Architecture Diagram

```mermaid
erDiagram
    EVENT ||--o{ OBSERVATION : "has dated geometries"
    EVENT ||--o{ EVENT_COUNTRY : "spatially intersects"
    COUNTRY_BOUNDARY ||--o{ EVENT_COUNTRY : "contains"
    COUNTRY_BOUNDARY ||--o| COUNTRY_PROFILE : "enriched demographic data"
    EVENT ||--o{ ARTICLE_MATCH : "scored candidate news"
    ARTICLE ||--o{ ARTICLE_MATCH : "linked evidence"
    SYNC_RUN ||--o{ EVENT : "tracks ingestion batch"

    EVENT {
        string id PK
        string title
        string category
        string status
        timestamp closed_at
        jsonb sources
        timestamp last_updated_at
        boolean news_enriched_on_open
        boolean news_enriched_on_close
    }

    OBSERVATION {
        bigserial id PK
        string event_id FK
        timestamp observed_at
        geometry geom "Point/LineString/Polygon EPSG:4326"
        float magnitude_value
        string magnitude_unit
    }

    COUNTRY_BOUNDARY {
        string iso_a3 PK
        string iso_a2
        string name
        geometry geom "MultiPolygon EPSG:4326"
        string dataset_version
    }

    COUNTRY_PROFILE {
        string iso_a3 PK,FK
        string iso_a2
        string name
        bigint population
        float area_sq_km
        int population_density
        jsonb currencies
        timestamp retrieved_at
    }

    EVENT_COUNTRY {
        string event_id PK,FK
        string iso_a3 PK,FK
        string match_method
    }

    ARTICLE {
        string canonical_url PK
        string original_url
        string title
        string description
        string publisher
        timestamp published_at
        timestamp retrieved_at
    }

    ARTICLE_MATCH {
        string event_id PK,FK
        string article_url PK,FK
        int score
        string confidence_label
        jsonb match_reasons
        string algorithm_version
    }

    SYNC_RUN {
        bigserial id PK
        string provider
        timestamp started_at
        timestamp ended_at
        string outcome
        int records_processed
        string error_class
    }
```

---

### 8.3 Internal REST API Endpoints Specification

All endpoints are versioned under `/api/v1` and enforce read-only `GET` access for public clients:

| Method | Endpoint Path | Query / Path Parameters | Purpose & Response Schema | Cache Policy |
| :--- | :--- | :--- | :--- | :--- |
| **`GET`** | `/api/v1/health` | None | Returns provider health, database connectivity, Redis connection, NewsAPI daily quota snapshot, and disclaimers. | No cache |
| **`GET`** | `/api/v1/events` | `category` (string)<br/>`status` (`open` \| `closed` \| `all`)<br/>`q` (string, max 120 chars)<br/>`start_date` / `end_date` (ISO)<br/>`bbox` (`minLon,minLat,maxLon,maxLat`)<br/>`limit` (1..2000, default 200)<br/>`cursor` (int) | Returns filtered GeoJSON FeatureCollection of hazards, observation geometries, and mandatory UI disclaimers. | Redis (60s TTL) |
| **`GET`** | `/api/v1/events/{id}` | `id` (path, string) | Fetches complete event detail, observation coordinate history, official NASA sources, matched country profile cards, and caveats. | Redis (120s TTL) |
| **`GET`** | `/api/v1/events/{id}/articles` | `id` (path, string) | Fetches deduplicated candidate news articles ranked by rule-based scoring with score badges and plain-language match reasons. | Redis (300s TTL) |
| **`POST`**| `/api/v1/sync` | `offline` (bool, default `false`) | Administrative endpoint to trigger on-demand synchronization loop (restricted to backend network). | No cache |

---

## 9. Data Processing, Matching & Demographic Pipelines

### 9.1 Data Normalization Rules
1. **Title Sanitization:** Leading/trailing whitespace and non-standard internal spaces are trimmed.
2. **Missing Magnitude Preservation:** If `magnitudeValue` is missing from EONET, it is stored strictly as `null` (never converted to `0` or arbitrary placeholders).
3. **Canonical URL Normalization:** All candidate news URLs are stripped of tracking query parameters (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `fbclid`, `gclid`, `ref`) and trailing slashes before computing SHA-256 hashes or storing as primary keys.

### 9.2 PostGIS Country Containment & Coastal Proximity
- **Primary Spatial Join:**
  ```sql
  SELECT DISTINCT c.iso_a3, c.name, 'intersects' AS match_method
  FROM country_boundary c
  JOIN observation o ON ST_Intersects(c.geom, o.geom)
  WHERE o.event_id = :event_id;
  ```
- **Coastal Proximity Fallback (for offshore hazards within 100 km):**
  ```sql
  SELECT DISTINCT c.iso_a3, c.name, 'coastal_proximity' AS match_method
  FROM country_boundary c
  JOIN observation o ON ST_DWithin(c.geom::geography, o.geom::geography, 100000)
  WHERE o.event_id = :event_id
  ORDER BY ST_Distance(c.geom::geography, o.geom::geography) ASC
  LIMIT 1;
  ```

### 9.3 Explainable News Scoring Rubric (`algorithm_version = 'v1'`)
Every candidate news article is scored transparently on a **0 to 100 point scale** based on four verifiable evidence criteria:

$$\text{Total Score} = \min(100, S_{\text{title}} + S_{\text{hazard}} + S_{\text{country}} + S_{\text{date}})$$

Where:
1. **$S_{\text{title}} = +35\text{ pts}$:** Distinct event name or place token from the EONET title appears in the article headline.
   - *Evidence string:* `"Matched event title phrase '<token>' (+35)"`
2. **$S_{\text{hazard}} = +25\text{ pts}$:** Specific hazard category keyword (`wildfire`, `typhoon`, `hurricane`, `volcano`, `eruption`, `flood`, `iceberg`, etc.) appears in title or description.
   - *Evidence string:* `"Matched hazard category keyword '<keyword>' (+25)"`
3. **$S_{\text{country}} = +25\text{ pts}$:** Matched country name or administrative place term appears in title or description.
   - *Evidence string:* `"Matched country/location '<country>' (+25)"`
4. **$S_{\text{date}} = +15\text{ pts}$:** Article publication date falls within the event observation window ($\pm 7\text{ days}$).
   - *Evidence string:* `"Published within event observation window (+15)"`

**Confidence Thresholds:**
- **Strong:** $\text{Score} \ge 70$
- **Moderate:** $45 \le \text{Score} \le 69$
- **Weak:** $25 \le \text{Score} \le 44$
- Articles scoring $< 25$ are discarded as irrelevant noise.

### 9.4 Guarded Population Density Math
Population density is calculated using sovereign country figures from REST Countries v3.1:

$$\text{Population Density} = \begin{cases} \text{null}, & \text{if } \text{area} \le 0 \lor \text{area is null} \lor \text{population is null} \\ \text{round}\left(\frac{\text{population}}{\text{area}}\right), & \text{otherwise} \end{cases}$$

The resulting integer is accompanied by the label **"National Average (people/km²)"** and a prominent caveat clarifying that it represents a country-wide demographic baseline, not local exposure in the disaster zone.

---

## 10. Security & Responsible Presentation

### 10.1 Security Architecture & Key Isolation (`NFR-04`)
1. **Zero Secret Leakage:** Third-party credentials (`NEWSAPI_KEY`, database connection strings) are loaded into memory exclusively inside the `backend` and `worker` containers via Pydantic `BaseSettings`. The `frontend` container contains zero secrets.
2. **Strict Public Read-Only Access:** All public endpoints accept only `GET` requests. Mutating routes (`POST /sync`) are shielded behind container network boundaries.
3. **Input Parameter Sanitization:** All query parameters (`category`, `status`, `start_date`, `end_date`, `bbox`) are validated by strict Pydantic schemas. Bounding box coordinates outside `[-180..180, -90..90]` return HTTP `422 Unprocessable Entity`.
4. **Network Segmentation:** Database port `5432` and Redis port `6379` are not exposed to the public internet; they exist only on the Docker internal bridge network (`backend_net`).
5. **CORS & Security Headers:** FastAPI and Nginx enforce `nosniff`, `frame-ancestors 'none'`, and CORS restrictions limiting API requests to `FRONTEND_ORIGIN`.

### 10.2 Mandatory User Interface Disclaimers (`NFR-10`)
To prevent dangerous misinterpretations during natural hazard events, the user interface persistently displays three explicit caveats:

1. **Satellite Geometry Disclaimer:**
   > *"Event coordinates and perimeters from NASA EONET v3 represent approximate satellite/agency observations and may reflect reporting latency. Do not use for local emergency navigation or life-safety decisions."*
2. **National Population Density Disclaimer:**
   > *"Population density is a national macro-level average calculated from REST Countries v3.1 ($\text{Population} \div \text{Area in km}^2$) and does not measure local population exposure inside the hazard footprint."*
3. **Contextual News Matching Disclaimer:**
   > *"News reports are matched contextually using keyword, location, and date proximity rules—not by verified GPS coordinates within the disaster perimeter."*

---

## 11. Reliability, Resilience & Fallback Operations

### 11.1 Graceful Degradation Model
The system enforces a multi-tiered resilience strategy to guarantee uptime during external API disruptions (`NFR-03`):

```mermaid
flowchart TD
    Start([Background Ingestion / User Query]) --> CheckProvider{Is External Provider<br/>Reachable?}
    CheckProvider -- Yes --> Ingest[Fetch & Normalize Payload]
    Ingest --> StoreSnap[Store Fresh Snapshot in PostGIS & Redis]
    StoreSnap --> Success[Mark Sync Success]
    
    CheckProvider -- No / HTTP 429 / 5xx / Timeout --> LogErr[Log Error Class in sync_run]
    LogErr --> FallbackState[Activate Fallback Snapshot Mode]
    FallbackState --> ReadCache[Serve Last Valid Snapshot from Redis/PostGIS]
    ReadCache --> Banner[Display Freshness Banner with Data Age]
```

### 11.2 NewsAPI Quota Resilience
When the daily request budget (`90` req/day) is reached:
1. The Redis quota tracker flags `can_consume() == False`.
2. The worker bypasses NewsAPI calls, logging outcome as `"rate_limited"` in `sync_run`.
3. The system activates the keyless fallback pipeline, querying Google News RSS and attaching curated UN OCHA ReliefWeb / NASA Earth Observatory research feeds with verified URLs.

---

## 12. Deployment & Container Delivery

### 12.1 Containerized Docker Compose Specification
The production system is delivered via `docker-compose.yml`:
- **`db`:** `postgis/postgis:16-3.4-alpine`, healthcheck via `pg_isready`, persistent volume `pgdata`.
- **`redis`:** `redis:7-alpine`, healthcheck via `redis-cli ping`, persistent volume `redisdata`.
- **`backend`:** Hardened multi-stage Python 3.11 slim image, unprivileged `appuser` (UID `10001`), `read_only: true` with `tmpfs: [/tmp]`, healthcheck on `/api/v1/health`.
- **`worker`:** Same hardened backend image running `python -m app.worker`.
- **`frontend`:** Multi-stage Vite build served via Nginx 1.27 alpine, unprivileged `appuser`, `read_only: true` with `tmpfs: [/tmp, /var/cache/nginx, /var/run]`.

### 12.2 Low-Spec Hardware Optimization ("Lite Mode")
To accommodate lower-powered laptops with integrated graphics:
- **On-Demand WebGL Rendering:** CesiumJS is configured with `requestRenderMode: true`, rendering frames only when camera movement occurs (reducing idle GPU usage by ~90%).
- **1-Click Lite Mode:** A persistent header toggle allows users to unmount the 3D WebGL globe entirely and use an ultra-fast, lightweight 2D list-and-drawer interface.

---

## 13. Verification & Testing Strategy

### 13.1 Test-Driven Development (TDD) Pyramid
All services follow a strict TDD methodology:
1. **Unit Tests (`backend/tests/unit/`):** Zero-I/O tests covering title sanitization, null magnitude handling, coordinate validation, guarded population density division, and rule-based news scoring.
2. **Adapter Contract Tests (`backend/tests/contract/`):** Recorded JSON fixtures testing EONET v3 parsing, REST Countries v3.1 batch parsing, and NewsAPI v2 quota handling.
3. **Integration Tests (`backend/tests/integration/`):** PostGIS `ST_Intersects` and `ST_DWithin` spatial query tests, idempotent upsert verification, and performance benchmarks proving **< 2s response for 2,000 events** (`NFR-01`).
4. **Frontend Component Tests (`frontend/src/test/`):** Vitest + React Testing Library verifying filter controls, keyboard navigation, Lite Mode toggle, and disclaimer rendering.
5. **End-to-End Tests (`frontend/e2e/`):** Playwright test suites covering primary exploration, `@axe-core/playwright` accessibility audits (`NFR-06`), and outage simulation.

---

## 14. Implementation Roadmap & Agile Sprints

The project was executed following the **Agile Scrum Methodology** across five structured phases and four iterative sprints:

```mermaid
gantt
    title Earth Event & Disaster Monitoring System Development Roadmap
    dateFormat  YYYY-MM-DD
    section Phase 1: Planning
    Requirements & API Contract Inspection   :done, p1, 2026-10-01, 2026-10-07
    section Phase 2: Design
    Spatial DB Schema & Compose Setup         :done, p2, 2026-10-08, 2026-10-14
    section Phase 3: Sprints
    Sprint 1: EONET Ingestion & PostGIS      :done, s1, 2026-10-15, 2026-10-22
    Sprint 2: Country Matching & Demographics:done, s2, 2026-10-23, 2026-10-29
    Sprint 3: News Scoring & Redis Caching   :done, s3, 2026-10-30, 2026-11-04
    Sprint 4: FastAPI Gateway & CesiumJS UI  :done, s4, 2026-11-05, 2026-11-08
    section Phase 4 & 5: Testing & Release
    Integration Testing & Benchmark (<2s)    :done, p4, 2026-11-09, 2026-11-10
    Final Containerized Release & Docs v2.0  :active, p5, 2026-11-11, 2026-11-11
```

- **Sprint 1 (FR-01 to FR-03):** Automated hazard ingestion, GeoJSON normalization, idempotent PostGIS upserts.
- **Sprint 2 (FR-07 to FR-09):** Natural Earth Admin 0 import, `ST_Intersects` spatial matching, REST Countries v3.1 integration, guarded density math.
- **Sprint 3 (FR-10 to FR-12, FR-14):** NewsAPI v2 adapter, quota tracking (90 req/day), rule-based scoring (`algorithm_version 1`), Redis caching.
- **Sprint 4 (FR-04 to FR-06, FR-13, FR-15):** FastAPI read gateway, React + CesiumJS 3D interface, Lite Mode, accessible sidebar, Playwright E2E verification.

---

## 15. Architecture Decision Records (ADRs) & Risk Management

### ADR-01: Asynchronous Python Scheduler vs. Celery Worker
- **Context:** The system requires recurring 10-minute ingestion runs and asynchronous news enrichment. Draft v1.0 suggested Celery with Redis.
- **Decision:** Implement a native Python asynchronous worker using `asyncio` and `httpx` inside a dedicated container (`earthemds-worker`).
- **Consequences:** Eliminates heavyweight Celery/Kombu dependencies, reduces image footprint by ~60%, simplifies Docker orchestration, and provides deterministic non-blocking I/O.

### ADR-02: Server-Side PostGIS Spatial Intersections vs. Client GIS
- **Context:** Associating events with countries could be done client-side or server-side.
- **Decision:** Load Natural Earth Admin 0 boundaries into PostGIS and perform all `ST_Intersects` and `ST_DWithin` operations server-side.
- **Consequences:** Protects low-spec client browsers from downloading multi-megabyte shapefiles, speeds up query times to under 50ms, and centralizes spatial indexing via GiST.

### ADR-03: Transparent Rule-Based Scoring vs. Black-Box NLP / LLMs
- **Context:** Candidate news matching requires linking articles to hazards.
- **Decision:** Implement an explainable rule-based scoring algorithm (`algorithm_version 1`) combining event tokens, category keywords, country names, and publication date proximity.
- **Consequences:** Requires zero costly GPU/LLM infrastructure, avoids non-deterministic hallucinations, executes in <1ms per article, and provides plain-language match evidence for end-user trust.

### ADR-04: Redis Rate-Limit Guard & Multi-Tier News Fallback
- **Context:** NewsAPI Developer plan limits usage to 100 requests/day.
- **Decision:** Enforce a hard daily cap of 90 requests in Redis, enriching each event once on open and once on close, with automatic fallback to Google News RSS and ReliefWeb.
- **Consequences:** Eliminates accidental quota overruns and guarantees the application always displays active, working news links even under strict quota exhaustion.

### ADR-05: Demand-Driven Rendering & 1-Click "Lite Mode" Toggle
- **Context:** Heavy WebGL 3D globes cause battery drain and frame drops on older student laptops.
- **Decision:** Configure CesiumJS with `requestRenderMode: true` and provide a 1-click header toggle to switch to a 2D list-and-drawer workspace.
- **Consequences:** Guarantees 100% feature accessibility across both high-end desktops and low-spec laptops (`NFR-06`).

---

## 16. Glossary & Acronyms

- **Admin 0:** Sovereign country administrative boundary level standardized by Natural Earth.
- **BBOX:** Bounding Box coordinate array `[minLon, minLat, maxLon, maxLat]` defining the visible map viewport.
- **CesiumJS:** Open-source JavaScript library for world-class 3D globes and 2D maps using WebGL.
- **EONET:** Earth Observatory Natural Event Tracker, curated by NASA.
- **EPSG:4326:** Standard spatial reference system using WGS 84 latitude/longitude coordinates.
- **GiST:** Generalized Search Tree, an indexing method used by PostgreSQL/PostGIS for high-speed spatial queries.
- **ISO 3166-1:** International standard for country codes (alpha-2 two-letter and alpha-3 three-letter codes).
- **Lite Mode:** A performance configuration that pauses WebGL rendering and presents a pure 2D list interface.
- **PostGIS:** Spatial database extension for PostgreSQL object-relational databases.
- **RFC 7946:** The official IETF specification defining the GeoJSON format and `[longitude, latitude]` axis ordering.
- **TDD:** Test-Driven Development (Red $\to$ Green $\to$ Refactor).
- **TTL:** Time-To-Live duration for cached entries in Redis.
- **WGS 84:** World Geodetic System 1984 coordinate reference ellipsoid.

---

## 17. References

1. Abbaspour, R., et al. (2026). Decoupled microservice architectures and API gateways in municipal crisis data infrastructure. *International Journal of Disaster Information Systems*, 18(2), 114–128.
2. Avcıoğlu, E., et al. (2025). Automated natural hazard harvesting from unstructured digital media archives: The tr-news-scraper pipeline. *Computers & Geosciences*, 172, 105280.
3. Cabrera, J., & Lee, S. (2020). Scale discrepancies and administrative boundary joins in WebGIS flood vulnerability assessments. *Journal of Environmental Management*, 260, 110112.
4. da Silva, L., et al. (2023). RiverCure: High-performance spatial database indexing and hydrodynamic simulation on Web GIS portals. *Environmental Modelling & Software*, 165, 105719.
5. Gao, Y., et al. (2025). Ground-truth satellite sensing versus social media soft sensing: Mitigating urban reporting bias during extreme storms. *Remote Sensing of Environment*, 302, 113970.
6. Goh, T., et al. (2023). Multi-source hazard mapping and localized disaster management platforms in Pasig City. *Philippine Journal of Science*, 152(4), 1321–1334.
7. Hanny, C., et al. (2026). NASA EOS/MODIS FIRMS and Copernicus Sentinel validation for multi-modal disaster detection architectures. *IEEE Transactions on Geoscience and Remote Sensing*, 64, 1–14.
8. Huang, X., & Usbeck, R. (2024). Overcoming the black-box opacity of neural language classifiers in crisis report geocoding. *Information Systems Frontiers*, 26(3), 889–905.
9. Li, W., et al. (2022). Enhancing spatial cognition and regional environmental coordination through 3D virtual web scenes in higher education. *Journal of Geography in Higher Education*, 46(1), 45–62.
10. Mudiyanselage, S., et al. (2026). WebGL 3D virtual globes versus immersive VR in volumetric disaster risk perception. *International Journal of Digital Earth*, 19(1), 22–39.
11. Pahuriray, J., & Cerna, M. (2025). FRiMap: Open-source WebGIS flood hazard visualization and community disaster risk reduction in Sagay City. *ASEAN Journal of Science and Technology for Development*, 42(1), 89–102.
12. Pascual, R., & Leonen, A. (2025). Integrating satellite flood perimeters with socioeconomic census indicators: A React and REST API implementation in Bulacan. *Asian Geographer*, 42(2), 177–195.
13. Pennington, C., et al. (2022). Quantifying the operational costs of manual geohazard tracking: Automated news harvesting at the British Geological Survey. *Geological Society, London, Special Publications*, 520, 311–324.
14. Phạm, H., & Nguyễn, T. (2026). From static 2D paper cartography to WebGL 3D digital earth environments in Southeast Asian disaster mitigation. *Cartography and Geographic Information Science*, 53(2), 145–161.
15. Shen, J., & Hwang, S. (2019). Spatial-temporal correlation analysis between EM-DAT disaster inventories and GAUL administrative boundaries. *Natural Hazards*, 98(3), 1017–1035.
16. Sufi, F. (2026). Global disaster signal extraction across 1.25 million news reports: Algorithmic reproducibility and sensor validation. *Information Processing & Management*, 63(1), 103551.
17. Sufi, F., & Alsulami, M. (2025). Automated news mining for crisis event detection: Credibility, temporal precision, and sentiment filtering. *IEEE Access*, 13, 21900–21915.
18. Ugliotti, F., et al. (2025). Server-side spatial indexing with PostGIS and Redis caching for responsive real-time emergency dashboards. *ISPRS International Journal of Geo-Information*, 14(3), 112.
19. Yang, C., et al. (2023). CesiumJS in modern web browsers: High-performance 3D visualization of global Earth observation datasets without plugins. *Computers, Environment and Urban Systems*, 99, 101905.
20. Yaneza, M., et al. (2025). ISO 25010 software quality evaluation of localized WebGIS platforms for emergency response in Calamba City. *Journal of Systems and Software*, 208, 111902.
