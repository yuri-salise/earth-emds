from datetime import datetime, timezone
import re
from app.services.normalizer import canonicalize_url

ALGORITHM_VERSION = "v1"

HAZARD_KEYWORDS: tuple[str, ...] = (
    "wildfire",
    "fire",
    "blaze",
    "bushfire",
    "storm",
    "typhoon",
    "hurricane",
    "cyclone",
    "volcano",
    "eruption",
    "ash",
    "seismic",
    "lava",
    "flood",
    "flooding",
    "inundation",
    "ice",
    "iceberg",
    "earthquake",
    "landslide",
    "drought",
)

GENERIC_TITLE_STOPWORDS = frozenset(
    {
        "the",
        "and",
        "near",
        "from",
        "with",
        "over",
        "into",
        "event",
        "sector",
        "region",
        "area",
        "north",
        "south",
        "east",
        "west",
        "central",
        "northern",
        "southern",
        "eastern",
        "western",
        "wildfire",
        "wildfires",
        "fire",
        "forest",
        "storm",
        "storms",
        "severe",
        "tropical",
        "typhoon",
        "hurricane",
        "cyclone",
        "volcano",
        "volcanoes",
        "flood",
        "floods",
        "sea",
        "lake",
        "ice",
        "iceberg",
        "track",
        "activity",
        "complex",
        "creek",
    }
)


def _extract_distinct_title_phrases(
    event_title: str,
    country_names: list[str] | None = None,
) -> list[str]:
    country_lower = {c.lower() for c in (country_names or [])}
    words = re.findall(r"[A-Za-z][A-Za-z0-9'-]{2,}", event_title or "")
    distinct: list[str] = []
    for w in words:
        wl = w.lower()
        if wl in GENERIC_TITLE_STOPWORDS or wl in country_lower:
            continue
        if w not in distinct:
            distinct.append(w)
    return distinct


def _parse_iso_dt(value: str | None) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    cleaned = value.strip()
    if cleaned.endswith("Z"):
        cleaned = cleaned[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(cleaned)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


def _is_within_observation_window(
    published_at: str | None,
    event_dates: list[str] | None,
    window_days: float = 7.0,
) -> bool:
    pub_dt = _parse_iso_dt(published_at)
    if pub_dt is None or not event_dates:
        return False
    for raw_date in event_dates:
        ev_dt = _parse_iso_dt(raw_date)
        if ev_dt is not None:
            diff_days = abs((pub_dt - ev_dt).total_seconds()) / 86400.0
            if diff_days <= window_days:
                return True
    return False


def _confidence_label(score: int) -> str:
    if score >= 70:
        return "Strong"
    if score >= 45:
        return "Moderate"
    return "Weak"


def score_candidate_article(
    article: dict,
    event_title: str,
    event_category: str = "",
    country_names: list[str] | None = None,
    event_dates: list[str] | None = None,
) -> dict:
    """Rule-based candidate article scorer (algorithm_version = 'v1')."""
    title = (article.get("title") or "").strip()
    description = (article.get("description") or "").strip()
    raw_url = article.get("url") or article.get("original_url") or article.get("canonical_url") or ""
    canonical = canonicalize_url(raw_url) if raw_url else ""

    title_lower = title.lower()
    combined_lower = f"{title} {description}".lower()

    score = 0
    match_reasons: list[str] = []

    # 1. +35 pts if distinct event location/name token from event title appears in article title
    distinct_phrases = _extract_distinct_title_phrases(event_title, country_names)
    for phrase in distinct_phrases:
        if re.search(rf"\b{re.escape(phrase.lower())}\b", title_lower):
            score += 35
            match_reasons.append(f"Matched event title phrase '{phrase}' (+35)")
            break

    # 2. +25 pts if hazard category keyword appears in title or description
    for kw in HAZARD_KEYWORDS:
        if re.search(rf"\b{re.escape(kw)}\b", combined_lower):
            score += 25
            match_reasons.append(f"Matched hazard category keyword '{kw}' (+25)")
            break

    # 3. +25 pts if matched country name or place term appears in title or description
    for country in (country_names or []):
        c_clean = country.strip()
        if c_clean and re.search(rf"\b{re.escape(c_clean.lower())}\b", combined_lower):
            score += 25
            match_reasons.append(f"Matched country/location '{c_clean}' (+25)")
            break

    # 4. +15 pts if article published_at is within event observation window (±7 days)
    if _is_within_observation_window(article.get("published_at"), event_dates, window_days=7.0):
        score += 15
        match_reasons.append("Published within event observation window (+15)")

    score = min(100, score)
    return {
        "canonical_url": canonical,
        "original_url": raw_url,
        "title": title,
        "description": description or None,
        "publisher": (article.get("publisher") or "News Wire").strip(),
        "published_at": article.get("published_at") or datetime.now(timezone.utc).isoformat(),
        "score": score,
        "confidence_label": _confidence_label(score),
        "match_reasons": match_reasons,
        "algorithm_version": ALGORITHM_VERSION,
    }


def score_and_rank_articles(
    articles: list[dict],
    event_title: str,
    event_category: str = "",
    country_names: list[str] | None = None,
    event_dates: list[str] | None = None,
    min_score: int = 25,
) -> list[dict]:
    """Score, filter (< min_score), deduplicate by canonical_url, and rank candidate articles."""
    by_canonical: dict[str, dict] = {}
    for raw in articles:
        try:
            scored = score_candidate_article(
                article=raw,
                event_title=event_title,
                event_category=event_category,
                country_names=country_names,
                event_dates=event_dates,
            )
        except ValueError:
            continue
        if scored["score"] < min_score or not scored["canonical_url"]:
            continue
        url_key = scored["canonical_url"]
        existing = by_canonical.get(url_key)
        if existing is None or scored["score"] > existing["score"]:
            by_canonical[url_key] = scored

    ranked = list(by_canonical.values())
    ranked.sort(key=lambda item: (item["score"], item.get("published_at") or ""), reverse=True)
    return ranked
