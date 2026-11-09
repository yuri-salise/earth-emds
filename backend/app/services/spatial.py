from functools import lru_cache
import json
import math
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "ne_admin0_countries.json"
COASTAL_BUFFER_KM = 100.0


@lru_cache(maxsize=1)
def load_admin0_boundaries() -> list[dict]:
    """Load local Natural Earth Admin 0 (1:10m) reference boundaries, excluding iso_a3 == '-99'."""
    raw = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    dataset_version = raw.get("dataset_version", "ne_10m_admin_0_v5.1.1")
    valid: list[dict] = []
    for feat in raw.get("features", []):
        iso3 = (feat.get("iso_a3") or "").strip().upper()
        if not iso3 or iso3 == "-99" or len(iso3) != 3:
            continue
        polygons = feat.get("polygons") or []
        bbox = feat.get("bbox")
        if not bbox and polygons:
            lons = [pt[0] for ring in polygons for pt in ring]
            lats = [pt[1] for ring in polygons for pt in ring]
            bbox = [min(lons), min(lats), max(lons), max(lats)]
        bbox_area = max(0.01, (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])) if bbox else 9999.0
        valid.append(
            {
                "iso_a3": iso3,
                "iso_a2": (feat.get("iso_a2") or "").strip().upper(),
                "name": feat.get("name") or iso3,
                "bbox": bbox,
                "bbox_area": bbox_area,
                "polygons": polygons,
                "dataset_version": dataset_version,
            }
        )
    return valid


def _point_in_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    """Ray-casting point-in-polygon check."""
    inside = False
    n = len(ring)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > lat) != (yj > lat)) and (
            lon < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi
        ):
            inside = not inside
        j = i
    return inside


def _haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Great-circle distance in kilometers between two WGS 84 points."""
    r = 6371.0088
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    )
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))


def _point_to_segment_distance_km(
    px: float,
    py: float,
    x1: float,
    y1: float,
    x2: float,
    y2: float,
) -> float:
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0.0 and dy == 0.0:
        return _haversine_km(px, py, x1, y1)
    t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    return _haversine_km(px, py, proj_x, proj_y)


def _extract_sample_points(geom: dict) -> list[tuple[float, float]]:
    gtype = geom.get("type")
    coords = geom.get("coordinates") or []
    pts: list[tuple[float, float]] = []
    if gtype == "Point" and len(coords) >= 2:
        pts.append((float(coords[0]), float(coords[1])))
    elif gtype == "LineString":
        for i, c in enumerate(coords):
            pts.append((float(c[0]), float(c[1])))
            if i > 0:
                prev = coords[i - 1]
                pts.append(((float(c[0]) + float(prev[0])) / 2.0, (float(c[1]) + float(prev[1])) / 2.0))
    elif gtype == "Polygon":
        for ring in coords:
            if not ring:
                continue
            lons = [float(c[0]) for c in ring]
            lats = [float(c[1]) for c in ring]
            pts.append((sum(lons) / len(lons), sum(lats) / len(lats)))
            for c in ring:
                pts.append((float(c[0]), float(c[1])))
    return pts


def extract_geometry_bbox(geometries: list[dict]) -> tuple[float, float, float, float] | None:
    """Compute [min_lon, min_lat, max_lon, max_lat] across one or more GeoJSON geometries."""
    pts: list[tuple[float, float]] = []
    for g in geometries:
        pts.extend(_extract_sample_points(g))
    if not pts:
        return None
    lons = [p[0] for p in pts]
    lats = [p[1] for p in pts]
    return (min(lons), min(lats), max(lons), max(lats))


def resolve_event_countries(
    geometries: list[dict],
    coastal_buffer_km: float = COASTAL_BUFFER_KM,
) -> list[dict]:
    """Resolve event geometries (Point, LineString, Polygon) to Admin 0 ISO codes.

    Uses exact polygon containment ('intersects') first and falls back to
    <= 100 km coastal buffer ('coastal_proximity') when offshore.
    Always omits iso_a3 == '-99'.
    """
    sample_points: list[tuple[float, float]] = []
    for geom in geometries:
        if isinstance(geom, dict):
            sample_points.extend(_extract_sample_points(geom))
    if not sample_points:
        return []

    boundaries = load_admin0_boundaries()
    matches_by_iso: dict[str, dict] = {}

    for pt_lon, pt_lat in sample_points:
        point_intersects: list[dict] = []
        for country in boundaries:
            iso3 = country["iso_a3"]
            if iso3 == "-99":
                continue
            bbox = country["bbox"]
            # Fast bounding-box pre-filter with 1.5 degree buffer (~165 km)
            if (
                pt_lon < bbox[0] - 1.5
                or pt_lon > bbox[2] + 1.5
                or pt_lat < bbox[1] - 1.5
                or pt_lat > bbox[3] + 1.5
            ):
                continue

            for ring in country["polygons"]:
                if _point_in_ring(pt_lon, pt_lat, ring):
                    point_intersects.append(country)
                    break

        if point_intersects:
            # If overlapping schematic polygons match the same point, pick the more specific country
            point_intersects.sort(key=lambda c: c["bbox_area"])
            best = point_intersects[0]
            matches_by_iso[best["iso_a3"]] = {
                "iso_a3": best["iso_a3"],
                "iso_a2": best["iso_a2"],
                "name": best["name"],
                "match_method": "intersects",
            }
            continue

        # Offshore fallback: check coastal proximity <= 100 km
        best_coastal: tuple[float, dict] | None = None
        for country in boundaries:
            iso3 = country["iso_a3"]
            if iso3 == "-99":
                continue
            bbox = country["bbox"]
            if (
                pt_lon < bbox[0] - 1.5
                or pt_lon > bbox[2] + 1.5
                or pt_lat < bbox[1] - 1.5
                or pt_lat > bbox[3] + 1.5
            ):
                continue
            min_dist = float("inf")
            for ring in country["polygons"]:
                for idx in range(len(ring) - 1):
                    d = _point_to_segment_distance_km(
                        pt_lon,
                        pt_lat,
                        ring[idx][0],
                        ring[idx][1],
                        ring[idx + 1][0],
                        ring[idx + 1][1],
                    )
                    if d < min_dist:
                        min_dist = d
            if min_dist <= coastal_buffer_km:
                if best_coastal is None or min_dist < best_coastal[0]:
                    best_coastal = (min_dist, country)

        if best_coastal is not None:
            c = best_coastal[1]
            iso3 = c["iso_a3"]
            if iso3 not in matches_by_iso:
                matches_by_iso[iso3] = {
                    "iso_a3": iso3,
                    "iso_a2": c["iso_a2"],
                    "name": c["name"],
                    "match_method": "coastal_proximity",
                }

    return list(matches_by_iso.values())
