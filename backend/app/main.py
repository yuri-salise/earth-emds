import asyncio
from collections import defaultdict, deque
from contextlib import asynccontextmanager
import time
from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.config import DISCLAIMERS, get_settings
from app.db import Database
from app.services.scorer import ALGORITHM_VERSION


def _parse_bbox(bbox_raw: str | None) -> tuple[float, float, float, float] | None:
    if not bbox_raw or not bbox_raw.strip():
        return None
    parts = [p.strip() for p in bbox_raw.split(",")]
    if len(parts) != 4:
        raise HTTPException(
            status_code=422,
            detail="bbox must be 4 comma-separated numbers: minLon,minLat,maxLon,maxLat",
        )
    try:
        min_lon, min_lat, max_lon, max_lat = (float(x) for x in parts)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="bbox coordinates must be numeric") from exc

    if (
        min_lon < -180.0
        or max_lon > 180.0
        or min_lat < -90.0
        or max_lat > 90.0
        or min_lon > max_lon
        or min_lat > max_lat
    ):
        raise HTTPException(
            status_code=422,
            detail="bbox coordinates out of WGS 84 bounds [-180..180, -90..90] or min > max",
        )
    return (min_lon, min_lat, max_lon, max_lat)


def create_app(
    db_instance: Database | None = None,
    enable_background_worker: bool = True,
) -> FastAPI:
    settings = get_settings()
    db = db_instance or Database()

    @asynccontextmanager
    async def lifespan(app_inst: FastAPI):
        db.init_schema()
        db.seed_initial_data()
        bg_task: asyncio.Task | None = None

        async def _periodic_sync_loop():
            # Initial non-blocking live sync attempt right after seed startup
            try:
                await db.run_live_sync(force_offline=False)
            except Exception:
                pass
            while True:
                await asyncio.sleep(settings.eonet_poll_interval_seconds)
                try:
                    await db.run_live_sync(force_offline=False)
                except Exception:
                    pass

        if enable_background_worker:
            bg_task = asyncio.create_task(_periodic_sync_loop())
        try:
            yield
        finally:
            if bg_task is not None:
                bg_task.cancel()

    app = FastAPI(
        title="Earth Event & Disaster Monitoring System API",
        version="1.0.0",
        description=(
            "Read-only gateway integrating NASA EONET v3 hazards, Natural Earth Admin 0 "
            "spatial containment, REST Countries v3.1 demographics, and explainable NewsAPI v2 scoring."
        ),
        lifespan=lifespan,
    )
    app.state.db = db

    allowed_origins = sorted(
        {
            settings.frontend_origin,
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
        }
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Accept", "Content-Type"],
    )

    # Per-IP sliding window rate limiter + mandatory HTTP security headers
    ip_buckets: dict[str, deque[float]] = defaultdict(deque)
    rate_limit = max(30, settings.rate_limit_per_minute)

    @app.middleware("http")
    async def security_and_rate_limit_middleware(request: Request, call_next):
        client_ip = request.client.host if request.client else "127.0.0.1"
        now = time.monotonic()
        bucket = ip_buckets[client_ip]
        while bucket and (now - bucket[0]) > 60.0:
            bucket.popleft()
        if len(bucket) >= rate_limit:
            return Response(
                content='{"detail":"Rate limit exceeded. Please retry in a minute."}',
                status_code=429,
                media_type="application/json",
            )
        bucket.append(now)

        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        return response

    @app.get("/api/v1/health")
    async def get_health():
        summary = db.get_health_summary()
        return {
            **summary,
            "environment": settings.environment,
            "disclaimers": DISCLAIMERS,
        }

    @app.get("/api/v1/events")
    async def list_events(
        category: str | None = Query(default=None, description="Hazard category filter"),
        status: str | None = Query(default=None, description="Event status: open or closed"),
        q: str | None = Query(default=None, max_length=120, description="Search query"),
        start_date: str | None = Query(default=None, description="ISO start date filter"),
        end_date: str | None = Query(default=None, description="ISO end date filter"),
        bbox: str | None = Query(
            default=None,
            description="Viewport bounding box: minLon,minLat,maxLon,maxLat",
        ),
        limit: int = Query(default=200, ge=1, le=2000),
        cursor: int = Query(default=0, ge=0),
    ):
        if status and status.lower() not in ("open", "closed", "all"):
            raise HTTPException(
                status_code=422,
                detail="status must be 'open', 'closed', or 'all'",
            )
        parsed_bbox = _parse_bbox(bbox)
        result = db.query_events(
            category=category,
            status=status,
            q=q,
            start_date=start_date,
            end_date=end_date,
            bbox=parsed_bbox,
            limit=limit,
            cursor=cursor,
        )
        return {
            **result,
            "disclaimers": DISCLAIMERS,
        }

    @app.get("/api/v1/events/{event_id}")
    async def get_event_detail(event_id: str):
        ev = db.get_event_by_id(event_id.strip())
        if ev is None:
            raise HTTPException(status_code=404, detail=f"Event '{event_id}' not found")
        return {
            **ev,
            "disclaimers": DISCLAIMERS,
        }

    @app.get("/api/v1/events/{event_id}/articles")
    async def get_event_articles(event_id: str):
        ev = db.get_event_by_id(event_id.strip())
        if ev is None:
            raise HTTPException(status_code=404, detail=f"Event '{event_id}' not found")
        articles = ev.get("articles") or []
        return {
            "event_id": ev["id"],
            "algorithm_version": ALGORITHM_VERSION,
            "items": articles,
            "articles": articles,
            "total": len(articles),
            "disclaimer": DISCLAIMERS["news_matching_caveat"],
            "disclaimers": DISCLAIMERS,
        }

    @app.post("/api/v1/sync")
    async def trigger_sync(offline: bool = Query(default=False)):
        result = await db.run_live_sync(force_offline=offline)
        return {
            **result,
            "disclaimers": DISCLAIMERS,
        }

    return app


app = create_app()
