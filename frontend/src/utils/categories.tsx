import React from 'react';
import { GeoJsonGeometry } from '../types/domain';

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
    let sumLon = 0;
    let sumLat = 0;
    for (const pt of ring) {
      sumLon += Number(pt[0]);
      sumLat += Number(pt[1]);
    }
    return [
      Number((sumLon / ring.length).toFixed(4)),
      Number((sumLat / ring.length).toFixed(4)),
    ];
  }
  return null;
}

export function formatWgs84([lon, lat]: [number, number]): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lon).toFixed(2)}°${lonDir} [${lon.toFixed(2)}, ${lat.toFixed(2)}]`;
}

export function formatUtcTimestamp(isoString: string | null | undefined): string {
  if (!isoString) return 'Unknown time';
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  } catch {
    return String(isoString);
  }
}
