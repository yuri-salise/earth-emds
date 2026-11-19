import React from 'react';
import { EventObservation, GeoJsonGeometry } from '../types/domain';

export interface CategoryMeta {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  bgSubtle: string;
  borderSubtle: string;
  Icon: React.FC<{ className?: string; size?: number }>;
}

const FlameIcon: React.FC<{ className?: string; size?: number }> = ({ className, size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </svg>
);

const CycloneIcon: React.FC<{ className?: string; size?: number }> = ({ className, size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M21 4H3" />
    <path d="M18 8H6" />
    <path d="M19 12H9" />
    <path d="M16 16h-6" />
    <path d="M11 20H9" />
  </svg>
);

const VolcanoIcon: React.FC<{ className?: string; size?: number }> = ({ className, size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="m2 20 7-11h6l7 11Z" />
    <path d="M9 9c1-2 2-3 3-3s2 1 3 3" />
    <path d="M12 2v2" />
    <path d="m8 4 1 1" />
    <path d="m16 4-1 1" />
  </svg>
);

const FloodIcon: React.FC<{ className?: string; size?: number }> = ({ className, size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M2 12c2-2.5 4-2.5 6 0s4 2.5 6 0 4-2.5 6 0" />
    <path d="M2 17c2-2.5 4-2.5 6 0s4 2.5 6 0 4-2.5 6 0" />
    <path d="M12 3c-2.5 3.2-4 5.2-4 6.8a4 4 0 0 0 8 0c0-1.6-1.5-3.6-4-6.8Z" />
  </svg>
);

const IceIcon: React.FC<{ className?: string; size?: number }> = ({ className, size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="12" y1="2" x2="12" y2="22" />
    <path d="m20 16-4-4 4-4" />
    <path d="m4 8 4 4-4 4" />
    <path d="m16 4-4 4-4-4" />
    <path d="m8 20 4-4 4 4" />
  </svg>
);

const SeismicPulseIcon: React.FC<{ className?: string; size?: number }> = ({
  className,
  size = 15,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

export const CATEGORY_MAP: Record<string, CategoryMeta> = {
  wildfires: {
    id: 'wildfires',
    label: 'Wildfires',
    shortLabel: 'Wildfire',
    color: '#F97316',
    bgSubtle: 'rgba(249, 115, 22, 0.14)',
    borderSubtle: 'rgba(249, 115, 22, 0.38)',
    Icon: FlameIcon,
  },
  severeStorms: {
    id: 'severeStorms',
    label: 'Severe Storms',
    shortLabel: 'Severe Storm',
    color: '#38BDF8',
    bgSubtle: 'rgba(56, 189, 248, 0.14)',
    borderSubtle: 'rgba(56, 189, 248, 0.38)',
    Icon: CycloneIcon,
  },
  volcanoes: {
    id: 'volcanoes',
    label: 'Volcanoes',
    shortLabel: 'Volcano',
    color: '#F43F5E',
    bgSubtle: 'rgba(244, 63, 94, 0.14)',
    borderSubtle: 'rgba(244, 63, 94, 0.38)',
    Icon: VolcanoIcon,
  },
  floods: {
    id: 'floods',
    label: 'Floods',
    shortLabel: 'Flood',
    color: '#6366F1',
    bgSubtle: 'rgba(99, 102, 241, 0.14)',
    borderSubtle: 'rgba(99, 102, 241, 0.38)',
    Icon: FloodIcon,
  },
  seaLakeIce: {
    id: 'seaLakeIce',
    label: 'Sea & Lake Ice',
    shortLabel: 'Sea/Lake Ice',
    color: '#2DD4BF',
    bgSubtle: 'rgba(45, 212, 191, 0.14)',
    borderSubtle: 'rgba(45, 212, 191, 0.38)',
    Icon: IceIcon,
  },
  earthquakes: {
    id: 'earthquakes',
    label: 'Earthquakes',
    shortLabel: 'Earthquake',
    color: '#A855F7',
    bgSubtle: 'rgba(168, 85, 247, 0.14)',
    borderSubtle: 'rgba(168, 85, 247, 0.38)',
    Icon: SeismicPulseIcon,
  },
  landslides: {
    id: 'landslides',
    label: 'Landslides',
    shortLabel: 'Landslide',
    color: '#A855F7',
    bgSubtle: 'rgba(168, 85, 247, 0.14)',
    borderSubtle: 'rgba(168, 85, 247, 0.38)',
    Icon: SeismicPulseIcon,
  },
  drought: {
    id: 'drought',
    label: 'Drought',
    shortLabel: 'Drought',
    color: '#A855F7',
    bgSubtle: 'rgba(168, 85, 247, 0.14)',
    borderSubtle: 'rgba(168, 85, 247, 0.38)',
    Icon: SeismicPulseIcon,
  },
};

export const FILTER_CATEGORIES: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'wildfires', label: 'Wildfires' },
  { id: 'severeStorms', label: 'Severe Storms' },
  { id: 'volcanoes', label: 'Volcanoes' },
  { id: 'floods', label: 'Floods' },
  { id: 'seaLakeIce', label: 'Sea & Lake Ice' },
];

const CATEGORY_ALIAS_LOOKUP: Record<string, string> = {
  wildfires: 'wildfires',
  wildfire: 'wildfires',
  severestorms: 'severeStorms',
  severestorm: 'severeStorms',
  volcanoes: 'volcanoes',
  volcano: 'volcanoes',
  floods: 'floods',
  flood: 'floods',
  sealakeice: 'seaLakeIce',
  seaandlakeice: 'seaLakeIce',
  earthquakes: 'earthquakes',
  earthquake: 'earthquakes',
  landslides: 'landslides',
  landslide: 'landslides',
  drought: 'drought',
  dusthaze: 'dustHaze',
  tempextremes: 'tempExtremes',
};

export function getCategoryMeta(categoryRaw: string): CategoryMeta {
  const normalized = (categoryRaw || '').trim();
  if (CATEGORY_MAP[normalized]) {
    return CATEGORY_MAP[normalized];
  }
  const clean = normalized.toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliasId = CATEGORY_ALIAS_LOOKUP[clean];
  if (aliasId && CATEGORY_MAP[aliasId]) {
    return CATEGORY_MAP[aliasId];
  }
  const lower = normalized.toLowerCase();
  if (lower.includes('wildfire') || lower.includes('fire')) return CATEGORY_MAP.wildfires;
  if (
    lower.includes('storm') ||
    lower.includes('cyclone') ||
    lower.includes('typhoon') ||
    lower.includes('hurricane')
  )
    return CATEGORY_MAP.severeStorms;
  if (lower.includes('volcan')) return CATEGORY_MAP.volcanoes;
  if (lower.includes('flood')) return CATEGORY_MAP.floods;
  if (lower.includes('ice') || lower.includes('glacier') || lower.includes('cryo'))
    return CATEGORY_MAP.seaLakeIce;
  if (lower.includes('quake') || lower.includes('seismic')) return CATEGORY_MAP.earthquakes;
  if (lower.includes('landslide')) return CATEGORY_MAP.landslides;
  if (lower.includes('drought')) return CATEGORY_MAP.drought;
  return {
    id: clean || 'earthquakes',
    label: normalized || 'Seismic / Other',
    shortLabel: normalized || 'Hazard',
    color: '#A855F7',
    bgSubtle: 'rgba(168, 85, 247, 0.14)',
    borderSubtle: 'rgba(168, 85, 247, 0.38)',
    Icon: SeismicPulseIcon,
  };
}

export function isCategoryMatch(eventCategory: string, filterCategory: string): boolean {
  if (!filterCategory || filterCategory === 'all') return true;
  const eventMeta = getCategoryMeta(eventCategory);
  const filterMeta = getCategoryMeta(filterCategory);
  return eventMeta.id === filterMeta.id;
}

/**
 * Extracts primary representative [lon, lat] WGS 84 coordinate from Point, LineString, or Polygon
 */
export function getRepresentativeCoord(geom: GeoJsonGeometry | undefined): [number, number] | null {
  if (!geom) return null;
  if (geom.type === 'Point' && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
    return [Number(geom.coordinates[0]), Number(geom.coordinates[1])];
  }
  if (geom.type === 'LineString' && Array.isArray(geom.coordinates) && geom.coordinates.length > 0) {
    const last = geom.coordinates[geom.coordinates.length - 1];
    return [Number(last[0]), Number(last[1])];
  }
  if (
    geom.type === 'Polygon' &&
    Array.isArray(geom.coordinates) &&
    geom.coordinates.length > 0 &&
    geom.coordinates[0].length > 0
  ) {
    const ring = geom.coordinates[0];
    // Exclude duplicated closing vertex in RFC 7946 linear rings so centroid is unbiased
    const last = ring[ring.length - 1];
    const isClosed =
      ring.length > 1 && Number(ring[0][0]) === Number(last[0]) && Number(ring[0][1]) === Number(last[1]);
    const count = isClosed ? ring.length - 1 : ring.length;
    let sumLon = 0;
    let sumLat = 0;
    for (let i = 0; i < count; i++) {
      sumLon += Number(ring[i][0]);
      sumLat += Number(ring[i][1]);
    }
    return [
      Number((sumLon / count).toFixed(4)),
      Number((sumLat / count).toFixed(4)),
    ];
  }
  return null;
}

export function getLatestObservation(
  observations: EventObservation[] | undefined
): EventObservation | undefined {
  if (!observations || observations.length === 0) return undefined;
  let latest = observations[0];
  let latestMs = Date.parse(latest.observed_at);
  for (let i = 1; i < observations.length; i++) {
    const ms = Date.parse(observations[i].observed_at);
    if (!Number.isNaN(ms) && (Number.isNaN(latestMs) || ms > latestMs)) {
      latest = observations[i];
      latestMs = ms;
    }
  }
  return latest;
}

export function getEarliestObservation(
  observations: EventObservation[] | undefined
): EventObservation | undefined {
  if (!observations || observations.length === 0) return undefined;
  let earliest = observations[0];
  let earliestMs = Date.parse(earliest.observed_at);
  for (let i = 1; i < observations.length; i++) {
    const ms = Date.parse(observations[i].observed_at);
    if (!Number.isNaN(ms) && (Number.isNaN(earliestMs) || ms < earliestMs)) {
      earliest = observations[i];
      earliestMs = ms;
    }
  }
  return earliest;
}

export function geometryIntersectsBbox(
  geom: GeoJsonGeometry | undefined,
  bbox: [number, number, number, number]
): boolean {
  if (!geom) return false;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  let gMinLon = Infinity;
  let gMaxLon = -Infinity;
  let gMinLat = Infinity;
  let gMaxLat = -Infinity;

  const visit = (lon: number, lat: number) => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    if (lon < gMinLon) gMinLon = lon;
    if (lon > gMaxLon) gMaxLon = lon;
    if (lat < gMinLat) gMinLat = lat;
    if (lat > gMaxLat) gMaxLat = lat;
  };

  if (geom.type === 'Point' && geom.coordinates.length >= 2) {
    visit(Number(geom.coordinates[0]), Number(geom.coordinates[1]));
  } else if (geom.type === 'LineString') {
    for (const pt of geom.coordinates) {
      if (pt.length >= 2) visit(Number(pt[0]), Number(pt[1]));
    }
  } else if (geom.type === 'Polygon') {
    for (const ring of geom.coordinates) {
      for (const pt of ring) {
        if (pt.length >= 2) visit(Number(pt[0]), Number(pt[1]));
      }
    }
  }

  if (gMinLon === Infinity) return false;
  return gMaxLon >= minLon && gMinLon <= maxLon && gMaxLat >= minLat && gMinLat <= maxLat;
}

export function safeExternalUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

export function formatWgs84([lon, lat]: [number, number]): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lon).toFixed(2)}°${lonDir} [${lon.toFixed(2)}, ${lat.toFixed(2)}]`;
}

export function formatCompactWgs84([lon, lat]: [number, number]): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lon).toFixed(2)}°${lonDir}`;
}

const UTC_DATE_FORMATTER = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'UTC',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatUtcTimestamp(isoString: string | null | undefined): string {
  if (!isoString) return 'Unknown time';
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return `${UTC_DATE_FORMATTER.format(date)} UTC`;
  } catch {
    return String(isoString);
  }
}
