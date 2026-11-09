export type HazardCategoryId =
  | 'wildfires'
  | 'severeStorms'
  | 'volcanoes'
  | 'floods'
  | 'seaLakeIce'
  | 'earthquakes'
  | 'landslides'
  | 'drought';

export interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number]; // WGS 84 [lon, lat]
}

export interface GeoJsonLineString {
  type: 'LineString';
  coordinates: Array<[number, number]>; // WGS 84 [[lon, lat], ...]
}

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: Array<Array<[number, number]>>; // WGS 84 [[[lon, lat], ...]]
}

export type GeoJsonGeometry = GeoJsonPoint | GeoJsonLineString | GeoJsonPolygon;

export interface EventObservation {
  id: string | number;
  observed_at: string;
  geom: GeoJsonGeometry;
  magnitude_value: number | null;
  magnitude_unit: string | null;
}

export interface EventSource {
  id: string;
  url: string;
  title?: string;
}

export interface CurrencyInfo {
  name: string;
  symbol?: string;
}

export interface MatchedCountry {
  iso_a3: string;
  iso_a2: string;
  name: string;
  population: number | null;
  area_sq_km: number | null;
  population_density: number | null;
  currencies: Record<string, CurrencyInfo>;
  match_method: 'intersects' | 'coastal_proximity';
  retrieved_at: string;
}

export interface ScoredArticle {
  canonical_url: string;
  original_url: string;
  title: string;
  description: string | null;
  publisher: string;
  published_at: string;
  retrieved_at?: string;
  score: number;
  confidence_label: 'Strong' | 'Moderate' | 'Weak';
  match_reasons: string[];
  algorithm_version: string;
}

export interface HazardEvent {
  id: string;
  title: string;
  category: string;
  status: 'open' | 'closed';
  closed_at: string | null;
  sources: EventSource[];
  first_seen_at: string;
  last_updated_at: string;
  observations: EventObservation[];
  countries: MatchedCountry[];
}

export interface EventFilters {
  q: string;
  category: string;
  status: 'all' | 'open' | 'closed';
  start_date: string;
  end_date: string;
  useBbox: boolean;
  bbox: [number, number, number, number] | null; // [minLon, minLat, maxLon, maxLat]
}

export interface ProviderSyncInfo {
  outcome: 'success' | 'partial' | 'error' | 'rate_limited' | string;
  last_sync_at: string | null;
  records_processed?: number;
  error_class?: string | null;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'offline';
  cache_freshness: 'fresh' | 'cached_fallback' | 'stale';
  last_updated_at: string;
  providers: {
    eonet: ProviderSyncInfo;
    rest_countries: ProviderSyncInfo;
    newsapi: ProviderSyncInfo;
  };
  is_demo_fallback?: boolean;
}

export interface EventsListResponse {
  items: HazardEvent[];
  total: number;
  last_updated_at: string;
  cache_freshness: 'fresh' | 'cached_fallback' | 'stale';
  is_demo_fallback?: boolean;
}
