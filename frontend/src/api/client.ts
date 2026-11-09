import {
  CurrencyInfo,
  EventFilters,
  EventObservation,
  EventsListResponse,
  EventSource,
  GeoJsonGeometry,
  HazardEvent,
  HealthStatus,
  MatchedCountry,
  ScoredArticle,
} from '../types/domain';
import { getRepresentativeCoord } from '../utils/categories';
import { FALLBACK_ARTICLES_BY_EVENT, FALLBACK_EVENTS, FALLBACK_HEALTH } from './fallbackData';

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

export function getApiBaseUrl(): string {
  const envUrl =
    typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL
      ? String(import.meta.env.VITE_API_BASE_URL).trim()
      : '';
  return (envUrl || DEFAULT_API_BASE_URL)
    .replace('://localhost:8000', '://127.0.0.1:8000')
    .replace(/\/+$/, '');
}

function normalizeGeometry(rawGeom: unknown): GeoJsonGeometry {
  if (rawGeom && typeof rawGeom === 'object') {
    const g = rawGeom as Record<string, unknown>;
    const type = String(g.type || 'Point');
    const coords = g.coordinates;
    if (type === 'Point' && Array.isArray(coords) && coords.length >= 2) {
      return {
        type: 'Point',
        coordinates: [Number(coords[0]), Number(coords[1])],
      };
    }
    if (type === 'LineString' && Array.isArray(coords)) {
      return {
        type: 'LineString',
        coordinates: coords.map((pt: unknown) => {
          const arr = Array.isArray(pt) ? pt : [0, 0];
          return [Number(arr[0]), Number(arr[1])] as [number, number];
        }),
      };
    }
    if (type === 'Polygon' && Array.isArray(coords)) {
      return {
        type: 'Polygon',
        coordinates: coords.map((ring: unknown) => {
          const ringArr = Array.isArray(ring) ? ring : [];
          return ringArr.map((pt: unknown) => {
            const arr = Array.isArray(pt) ? pt : [0, 0];
            return [Number(arr[0]), Number(arr[1])] as [number, number];
          });
        }),
      };
    }
  }
  return { type: 'Point', coordinates: [0, 0] };
}

function normalizeObservation(raw: unknown, index: number): EventObservation {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const geomSource = obj.geom ?? obj.geometry ?? {
    type: obj.type || 'Point',
    coordinates: obj.coordinates || [0, 0],
  };
  const magVal =
    obj.magnitude_value !== undefined
      ? obj.magnitude_value
      : obj.magnitudeValue !== undefined
        ? obj.magnitudeValue
        : null;
  const magUnit =
    obj.magnitude_unit !== undefined
      ? obj.magnitude_unit
      : obj.magnitudeUnit !== undefined
        ? obj.magnitudeUnit
        : null;

  return {
    id: (obj.id as string | number) ?? index,
    observed_at: String(obj.observed_at || obj.observedAt || obj.date || new Date().toISOString()),
    geom: normalizeGeometry(geomSource),
    magnitude_value: magVal === null || magVal === undefined ? null : Number(magVal),
    magnitude_unit: magUnit === null || magUnit === undefined ? null : String(magUnit),
  };
}

function normalizeCountry(raw: unknown): MatchedCountry {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pop =
    obj.population === null || obj.population === undefined ? null : Number(obj.population);
  const areaRaw = obj.area_sq_km !== undefined ? obj.area_sq_km : obj.area;
  const area = areaRaw === null || areaRaw === undefined ? null : Number(areaRaw);

  let density: number | null = null;
  if (obj.population_density !== undefined && obj.population_density !== null) {
    density = Number(obj.population_density);
  } else if (pop !== null && area !== null && area > 0) {
    density = Math.round(pop / area);
  }

  const rawCurrencies =
    obj.currencies && typeof obj.currencies === 'object'
      ? (obj.currencies as Record<string, CurrencyInfo>)
      : {};

  const methodRaw = String(obj.match_method || obj.matchMethod || 'intersects');
  const match_method: 'intersects' | 'coastal_proximity' =
    methodRaw === 'coastal_proximity' ? 'coastal_proximity' : 'intersects';

  return {
    iso_a3: String(obj.iso_a3 || obj.cca3 || 'UNK'),
    iso_a2: String(obj.iso_a2 || obj.cca2 || ''),
    name: String(obj.name || obj.iso_a3 || 'Unknown Country'),
    population: pop,
    area_sq_km: area,
    population_density: density,
    currencies: rawCurrencies,
    match_method,
    retrieved_at: String(obj.retrieved_at || obj.as_of || new Date().toISOString()),
  };
}

function normalizeSources(rawSources: unknown): EventSource[] {
  if (!Array.isArray(rawSources)) return [];
  const result: EventSource[] = [];
  rawSources.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const s = item as Record<string, unknown>;
    const url = String(s.url || '').trim();
    if (!url) return;
    const entry: EventSource = {
      id: String(s.id || `SRC_${idx + 1}`),
      url,
    };
    if (s.title) {
      entry.title = String(s.title);
    }
    result.push(entry);
  });
  return result;
}

export function normalizeEvent(raw: unknown): HazardEvent {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const obsRaw = Array.isArray(obj.observations)
    ? obj.observations
    : Array.isArray(obj.geometry)
      ? obj.geometry
      : Array.isArray(obj.geometries)
        ? obj.geometries
        : obj.latest_geometry || obj.geom
          ? [
              {
                id: 1,
                observed_at: obj.last_updated_at || obj.observed_at || new Date().toISOString(),
                geom: obj.latest_geometry || obj.geom,
                magnitude_value: obj.magnitude_value ?? null,
                magnitude_unit: obj.magnitude_unit ?? null,
              },
            ]
          : [];

  const countriesRaw = Array.isArray(obj.countries)
    ? obj.countries
    : Array.isArray(obj.matched_countries)
      ? obj.matched_countries
      : [];

  const statusRaw = String(obj.status || 'open').toLowerCase();
  const status: 'open' | 'closed' = statusRaw === 'closed' ? 'closed' : 'open';

  return {
    id: String(obj.id || ''),
    title: String(obj.title || 'Untitled Event').trim().replace(/\s+/g, ' '),
    category: String(obj.category || 'wildfires'),
    status,
    closed_at: obj.closed_at ? String(obj.closed_at) : obj.closed ? String(obj.closed) : null,
    sources: normalizeSources(obj.sources),
    first_seen_at: String(obj.first_seen_at || obj.last_updated_at || new Date().toISOString()),
    last_updated_at: String(
      obj.last_updated_at || obj.last_updated || obj.first_seen_at || new Date().toISOString()
    ),
    observations: obsRaw.map((o, idx) => normalizeObservation(o, idx)),
    countries: countriesRaw.map((c) => normalizeCountry(c)),
  };
}

export function normalizeArticle(raw: unknown): ScoredArticle {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const score = Number(obj.score ?? 50);
  const labelRaw = String(obj.confidence_label || '');
  let confidence_label: 'Strong' | 'Moderate' | 'Weak' = 'Moderate';
  if (labelRaw === 'Strong' || labelRaw === 'Moderate' || labelRaw === 'Weak') {
    confidence_label = labelRaw;
  } else if (score >= 70) {
    confidence_label = 'Strong';
  } else if (score >= 45) {
    confidence_label = 'Moderate';
  } else {
    confidence_label = 'Weak';
  }

  const reasons = Array.isArray(obj.match_reasons)
    ? obj.match_reasons.map((r) => String(r))
    : [];

  const canonical = String(obj.canonical_url || obj.article_url || obj.url || '');
  const original = String(obj.original_url || obj.url || canonical);

  return {
    canonical_url: canonical,
    original_url: original,
    title: String(obj.title || 'Untitled News Report'),
    description: obj.description ? String(obj.description) : null,
    publisher: String(obj.publisher || obj.source_name || 'Global Press Wire'),
    published_at: String(obj.published_at || new Date().toISOString()),
    retrieved_at: obj.retrieved_at ? String(obj.retrieved_at) : undefined,
    score,
    confidence_label,
    match_reasons: reasons,
    algorithm_version: String(obj.algorithm_version || 'v1'),
  };
}

export function filterEventsClientSide(
  events: HazardEvent[],
  filters: EventFilters
): HazardEvent[] {
  return events.filter((ev) => {
    if (filters.category && filters.category !== 'all') {
      if (ev.category.toLowerCase() !== filters.category.toLowerCase()) {
        return false;
      }
    }
    if (filters.status && filters.status !== 'all') {
      if (ev.status !== filters.status) {
        return false;
      }
    }
    if (filters.q.trim()) {
      const qLower = filters.q.trim().toLowerCase();
      const inTitle = ev.title.toLowerCase().includes(qLower);
      const inId = ev.id.toLowerCase().includes(qLower);
      const inCategory = ev.category.toLowerCase().includes(qLower);
      const inCountries = ev.countries.some(
        (c) =>
          c.name.toLowerCase().includes(qLower) ||
          c.iso_a3.toLowerCase().includes(qLower) ||
          c.iso_a2.toLowerCase().includes(qLower)
      );
      if (!inTitle && !inId && !inCategory && !inCountries) {
        return false;
      }
    }
    if (filters.start_date) {
      const startMs = Date.parse(filters.start_date + 'T00:00:00Z');
      if (!Number.isNaN(startMs)) {
        const latestObs = ev.observations[0]?.observed_at || ev.last_updated_at;
        const evMs = Date.parse(latestObs);
        if (!Number.isNaN(evMs) && evMs < startMs) {
          return false;
        }
      }
    }
    if (filters.end_date) {
      const endMs = Date.parse(filters.end_date + 'T23:59:59Z');
      if (!Number.isNaN(endMs)) {
        const latestObs = ev.observations[0]?.observed_at || ev.last_updated_at;
        const evMs = Date.parse(latestObs);
        if (!Number.isNaN(evMs) && evMs > endMs) {
          return false;
        }
      }
    }
    if (filters.useBbox && filters.bbox) {
      const [minLon, minLat, maxLon, maxLat] = filters.bbox;
      const coord = getRepresentativeCoord(ev.observations[0]?.geom);
      if (coord) {
        const [lon, lat] = coord;
        if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) {
          return false;
        }
      }
    }
    return true;
  });
}

export async function fetchEvents(filters: EventFilters): Promise<EventsListResponse> {
  const baseUrl = getApiBaseUrl();
  const params = new URLSearchParams();

  if (filters.q.trim()) params.set('q', filters.q.trim());
  if (filters.category && filters.category !== 'all') params.set('category', filters.category);
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.start_date) params.set('start_date', filters.start_date);
  if (filters.end_date) params.set('end_date', filters.end_date);
  if (filters.useBbox && filters.bbox) {
    params.set('bbox', filters.bbox.map((n) => n.toFixed(2)).join(','));
  }
  params.set('limit', '500');

  const queryStr = params.toString();
  const url = `${baseUrl}/events${queryStr ? `?${queryStr}` : ''}`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const payload = await res.json();
    const rawList = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(payload.events)
          ? payload.events
          : Array.isArray(payload.data)
            ? payload.data
            : [];

    const normalized = rawList.map((item: unknown) => normalizeEvent(item));
    const filtered = filterEventsClientSide(normalized, filters);

    return {
      items: filtered,
      total: typeof payload.total === 'number' ? payload.total : filtered.length,
      last_updated_at: String(
        payload.last_updated_at ||
          payload.last_updated ||
          normalized[0]?.last_updated_at ||
          FALLBACK_HEALTH.last_updated_at
      ),
      cache_freshness:
        payload.cache_freshness === 'cached_fallback' || payload.cache_freshness === 'stale'
          ? payload.cache_freshness
          : 'fresh',
      is_demo_fallback: false,
    };
  } catch {
    const filteredFallback = filterEventsClientSide(FALLBACK_EVENTS, filters);
    return {
      items: filteredFallback,
      total: filteredFallback.length,
      last_updated_at: FALLBACK_HEALTH.last_updated_at,
      cache_freshness: 'cached_fallback',
      is_demo_fallback: true,
    };
  }
}

export async function fetchEventDetail(eventId: string): Promise<HazardEvent | null> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/events/${encodeURIComponent(eventId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const payload = await res.json();
    return normalizeEvent(payload);
  } catch {
    const fallback = FALLBACK_EVENTS.find((e) => e.id === eventId) || null;
    return fallback;
  }
}

export async function fetchEventArticles(eventId: string): Promise<ScoredArticle[]> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/events/${encodeURIComponent(eventId)}/articles`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const payload = await res.json();
    const rawList = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(payload.articles)
          ? payload.articles
          : [];
    const articles = rawList
      .map((item: unknown) => normalizeArticle(item))
      .sort((a: ScoredArticle, b: ScoredArticle) => b.score - a.score);
    return articles;
  } catch {
    return FALLBACK_ARTICLES_BY_EVENT[eventId] || [];
  }
}

export async function fetchHealthStatus(): Promise<HealthStatus> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const p = await res.json();
    const providersObj = p.providers && typeof p.providers === 'object' ? p.providers : {};
    return {
      status: p.status === 'degraded' || p.status === 'offline' ? p.status : 'healthy',
      cache_freshness:
        p.cache_freshness === 'cached_fallback' || p.cache_freshness === 'stale'
          ? p.cache_freshness
          : 'fresh',
      last_updated_at: String(
        p.last_updated_at || p.last_updated || FALLBACK_HEALTH.last_updated_at
      ),
      providers: {
        eonet: providersObj.eonet || FALLBACK_HEALTH.providers.eonet,
        rest_countries: providersObj.rest_countries || FALLBACK_HEALTH.providers.rest_countries,
        newsapi: providersObj.newsapi || FALLBACK_HEALTH.providers.newsapi,
      },
      is_demo_fallback: false,
    };
  } catch {
    return {
      ...FALLBACK_HEALTH,
      status: 'degraded',
      cache_freshness: 'cached_fallback',
      is_demo_fallback: true,
    };
  }
}
