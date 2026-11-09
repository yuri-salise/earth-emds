import math
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

TRACKING_QUERY_PARAMS = frozenset(
    {
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "fbclid",
        "gclid",
        "ref",
        "mc_cid",
        "mc_eid",
        "msclkid",
        "igshid",
    }
)


def clean_event_title(title: str) -> str:
    """Trim and collapse non-standard whitespace in event titles."""
    if not isinstance(title, str):
        raise ValueError("Event title must be a string")
    cleaned = re.sub(r"[\s\u00a0]+", " ", title).strip()
    if not cleaned:
        raise ValueError("Event title must not be empty")
    return cleaned


def normalize_magnitude(value: float | int | None) -> float | None:
    """Preserve None strictly as None; convert finite numeric values to float."""
    if value is None:
        return None
    if isinstance(value, bool):
        raise ValueError("Magnitude value cannot be a boolean")
    try:
        numeric = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid magnitude value: {value!r}") from exc
    if math.isnan(numeric) or math.isinf(numeric):
        raise ValueError("Magnitude value must be finite")
    return numeric


def canonicalize_url(url: str) -> str:
    """Strip tracking query parameters, fragments, and trailing slashes for deduplication."""
    if not isinstance(url, str) or not url.strip():
        raise ValueError("URL must be a non-empty string")
    raw = url.strip()
    parts = urlsplit(raw)
    scheme = parts.scheme.lower()
    netloc = parts.netloc.lower()
    if scheme not in ("http", "https") or not netloc:
        raise ValueError(f"Invalid HTTP/HTTPS URL: {url!r}")

    path = parts.path or ""
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    elif path == "/":
        path = ""

    filtered_params = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=False)
        if k.lower() not in TRACKING_QUERY_PARAMS and not k.lower().startswith("utm_")
    ]
    filtered_params.sort(key=lambda item: (item[0], item[1]))
    query_str = urlencode(filtered_params)

    return urlunsplit((scheme, netloc, path, query_str, ""))


def _validate_position(pos: object) -> list[float]:
    if not isinstance(pos, (list, tuple)) or len(pos) < 2:
        raise ValueError(f"Coordinate position must be [lon, lat], got {pos!r}")
    try:
        lon = float(pos[0])
        lat = float(pos[1])
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Non-numeric coordinate position: {pos!r}") from exc
    if math.isnan(lon) or math.isinf(lon) or lon < -180.0 or lon > 180.0:
        raise ValueError(f"Invalid longitude {lon}: must be between -180 and 180")
    if math.isnan(lat) or math.isinf(lat) or lat < -90.0 or lat > 90.0:
        raise ValueError(f"Invalid latitude {lat}: must be between -90 and 90")
    return [lon, lat]


def validate_geojson_geometry(geom: dict) -> dict:
    """Validate Point, LineString, and Polygon GeoJSON geometries in WGS 84 [lon, lat]."""
    if not isinstance(geom, dict):
        raise ValueError("Geometry must be a GeoJSON dictionary")
    geom_type = geom.get("type")
    coords = geom.get("coordinates")
    if not coords or not isinstance(coords, (list, tuple)):
        raise ValueError("Geometry coordinates must be a non-empty list")

    if geom_type == "Point":
        validated_coords = _validate_position(coords)
        return {"type": "Point", "coordinates": validated_coords}

    if geom_type == "LineString":
        if len(coords) < 2:
            raise ValueError("LineString must contain at least 2 coordinate positions")
        validated_line = [_validate_position(pt) for pt in coords]
        return {"type": "LineString", "coordinates": validated_line}

    if geom_type == "Polygon":
        validated_rings = []
        for ring in coords:
            if not isinstance(ring, (list, tuple)) or len(ring) < 4:
                raise ValueError("Polygon linear ring must have at least 4 positions")
            validated_ring = [_validate_position(pt) for pt in ring]
            validated_rings.append(validated_ring)
        if not validated_rings:
            raise ValueError("Polygon must contain at least one linear ring")
        return {"type": "Polygon", "coordinates": validated_rings}

    raise ValueError(f"Unsupported GeoJSON geometry type: {geom_type!r}")
