import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HazardEvent } from '../types/domain';
import {
  CATEGORY_MAP,
  CategoryMeta,
  formatWgs84,
  getCategoryMeta,
  getRepresentativeCoord,
} from '../utils/categories';
import { soundFx } from '../utils/soundFx';
import {
  LandmassPolygon,
  WORLD_LABELS,
  WORLD_LAKES,
  WORLD_LANDMASSES,
  WorldRegionLabel,
} from '../utils/worldLandmarks';

interface GlobeCanvasProps {
  events: HazardEvent[];
  selectedEvent: HazardEvent | null;
  onSelectEvent: (event: HazardEvent) => void;
  onViewportBboxChange: (bbox: [number, number, number, number]) => void;
  useBboxFilter: boolean;
}

interface Vec3Point {
  lon: number;
  lat: number;
  vx: number;
  vy: number;
  vz: number;
}

interface PrecomputedPolygon {
  name: string;
  iso?: string;
  paletteIdx: number;
  isAntarctica: boolean;
  points: Vec3Point[];
  cx3: number;
  cy3: number;
  cz3: number;
  sinRadius: number;
}

interface PrecomputedLabel {
  label: WorldRegionLabel;
  point: Vec3Point;
  displayText: string;
}

interface ProjectedMarker {
  event: HazardEvent;
  x: number;
  y: number;
  lon: number;
  lat: number;
  color: string;
}

interface PrecomputedEventRenderData {
  event: HazardEvent;
  meta: CategoryMeta;
  repPoint: Vec3Point | null;
  polygons: Vec3Point[][];
  lines: Vec3Point[][];
}

const DEG_TO_RAD = Math.PI / 180;

// 5 Realistic satellite cartographic biome/regional palettes
const BIOME_PALETTES = [
  // 0: Polar & Glacial (Antarctica, Greenland, Iceland)
  {
    fill: 'rgba(148, 184, 218, 0.34)',
    stroke: 'rgba(186, 230, 253, 0.46)',
  },
  // 1: Boreal & Northern Temperate (North America, Europe, Northern/Eastern Asia)
  {
    fill: 'rgba(26, 49, 68, 0.88)',
    stroke: 'rgba(100, 162, 198, 0.44)',
  },
  // 2: Arid & Subtropical Belt (North Africa, Middle East, Central Asia)
  {
    fill: 'rgba(38, 54, 68, 0.88)',
    stroke: 'rgba(118, 168, 196, 0.42)',
  },
  // 3: Tropical & Equatorial Emerald (SE Asia, South Asia, Sub-Saharan Africa, Central/South America)
  {
    fill: 'rgba(22, 56, 66, 0.90)',
    stroke: 'rgba(72, 184, 198, 0.48)',
  },
  // 4: Austral & Southern Continents (Australia, New Zealand, Southern Cone)
  {
    fill: 'rgba(32, 52, 68, 0.88)',
    stroke: 'rgba(92, 168, 204, 0.45)',
  },
] as const;

function toVec3(lon: number, lat: number): Vec3Point {
  const lambda = lon * DEG_TO_RAD;
  const phi = lat * DEG_TO_RAD;
  const cosPhi = Math.cos(phi);
  return {
    lon,
    lat,
    vx: cosPhi * Math.sin(lambda),
    vy: Math.sin(phi),
    vz: cosPhi * Math.cos(lambda),
  };
}

function chooseBiomePalette(land: LandmassPolygon): number {
  const iso = land.iso || '';
  const cont = land.continent || '';
  const sub = land.subregion || '';
  if (cont === 'Antarctica' || iso === 'ATA' || iso === 'GRL' || iso === 'ISL') {
    return 0;
  }
  if (
    sub === 'Northern Africa' ||
    sub === 'Western Asia' ||
    sub === 'Central Asia'
  ) {
    return 2;
  }
  if (
    sub === 'South-Eastern Asia' ||
    sub === 'Southern Asia' ||
    sub === 'Central America' ||
    sub === 'Caribbean' ||
    sub === 'Tropical South America' ||
    cont === 'South America' ||
    cont === 'Africa' ||
    sub === 'Melanesia' ||
    sub === 'Micronesia' ||
    sub === 'Polynesia'
  ) {
    return 3;
  }
  if (cont === 'Oceania') {
    return 4;
  }
  return 1;
}

function buildPrecomputedPolygon(land: LandmassPolygon): PrecomputedPolygon {
  const points = land.coordinates.map(([lon, lat]) => toVec3(lon, lat));
  let sx = 0;
  let sy = 0;
  let sz = 0;
  const n = points.length || 1;
  for (let i = 0; i < n; i++) {
    sx += points[i].vx;
    sy += points[i].vy;
    sz += points[i].vz;
  }
  const norm = Math.hypot(sx, sy, sz) || 1;
  const cx3 = sx / norm;
  const cy3 = sy / norm;
  const cz3 = sz / norm;

  let minDot = 1;
  for (let i = 0; i < n; i++) {
    const dot = cx3 * points[i].vx + cy3 * points[i].vy + cz3 * points[i].vz;
    if (dot < minDot) minDot = dot;
  }
  const maxAngle = Math.acos(Math.max(-1, Math.min(1, minDot)));
  const sinRadius = Math.min(0.98, Math.sin(Math.min(Math.PI * 0.49, maxAngle + 0.05)));

  return {
    name: land.name,
    iso: land.iso,
    paletteIdx: chooseBiomePalette(land),
    isAntarctica: land.name === 'Antarctica' || land.iso === 'ATA',
    points,
    cx3,
    cy3,
    cz3,
    sinRadius,
  };
}

// Precompute static world landmasses, lakes, and labels once at module load (zero per-frame trig)
const PRECOMPUTED_LANDMASSES: PrecomputedPolygon[] = WORLD_LANDMASSES.map(buildPrecomputedPolygon);
const PRECOMPUTED_BY_PALETTE: PrecomputedPolygon[][] = BIOME_PALETTES.map((_, idx) =>
  PRECOMPUTED_LANDMASSES.filter((p) => p.paletteIdx === idx)
);
const PRECOMPUTED_LAKES: PrecomputedPolygon[] = WORLD_LAKES.map(buildPrecomputedPolygon);
const PRECOMPUTED_LABELS: PrecomputedLabel[] = WORLD_LABELS.map((label) => ({
  label,
  point: toVec3(label.lon, label.lat),
  displayText: label.kind === 'country' ? label.text : label.text.toUpperCase(),
}));

// Precompute graticule meridians & parallels once at module load
const PRECOMPUTED_MERIDIANS: Vec3Point[][] = [];
for (let lon = -180; lon < 180; lon += 30) {
  const line: Vec3Point[] = [];
  for (let lat = -75; lat <= 75; lat += 6) {
    line.push(toVec3(lon, lat));
  }
  PRECOMPUTED_MERIDIANS.push(line);
}

const PRECOMPUTED_PARALLELS: Vec3Point[][] = [];
for (let lat = -60; lat <= 60; lat += 30) {
  if (lat === 0) continue;
  const line: Vec3Point[] = [];
  for (let lon = -180; lon <= 180; lon += 6) {
    line.push(toVec3(lon, lat));
  }
  PRECOMPUTED_PARALLELS.push(line);
}

const PRECOMPUTED_EQUATOR: Vec3Point[] = [];
for (let lon = -180; lon <= 180; lon += 5) {
  PRECOMPUTED_EQUATOR.push(toVec3(lon, 0));
}

// Reusable scratch buffers for horizon clipping (avoids per-frame array allocations)
const SCRATCH_RX = new Float64Array(2048);
const SCRATCH_RY = new Float64Array(2048);
const SCRATCH_RZ = new Float64Array(2048);

function tracePolygonFillOnSphere(
  ctx: CanvasRenderingContext2D,
  poly: PrecomputedPolygon,
  cx: number,
  cy: number,
  radius: number,
  sinLon0: number,
  cosLon0: number,
  sinLat0: number,
  cosLat0: number,
  camVx: number,
  camVy: number,
  camVz: number
): void {
  const centerCosC = poly.cx3 * camVx + poly.cy3 * camVy + poly.cz3 * camVz;
  // Fast 3D bounding-sphere back-hemisphere cull
  if (centerCosC < -poly.sinRadius) return;

  const pts = poly.points;
  const n = pts.length;
  if (n < 3) return;

  // Fast path: 100% of polygon is guaranteed on the front visible hemisphere
  if (centerCosC > poly.sinRadius) {
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const rx = p.vx * cosLon0 - p.vz * sinLon0;
      const rz = p.vx * sinLon0 + p.vz * cosLon0;
      const ry = p.vy * cosLat0 - rz * sinLat0;
      const sx = cx + radius * rx;
      const sy = cy - radius * ry;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    return;
  }

  // Horizon-straddling check
  let minZ = 1;
  let maxZ = -1;
  const len = Math.min(n, SCRATCH_RX.length);
  for (let i = 0; i < len; i++) {
    const p = pts[i];
    const rx = p.vx * cosLon0 - p.vz * sinLon0;
    const rz = p.vx * sinLon0 + p.vz * cosLon0;
    const ry = p.vy * cosLat0 - rz * sinLat0;
    const z = p.vy * sinLat0 + rz * cosLat0;
    SCRATCH_RX[i] = rx;
    SCRATCH_RY[i] = ry;
    SCRATCH_RZ[i] = z;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  if (maxZ <= 0) return;

  if (minZ >= 0) {
    for (let i = 0; i < len; i++) {
      const sx = cx + radius * SCRATCH_RX[i];
      const sy = cy - radius * SCRATCH_RY[i];
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    return;
  }

  // Exact 3D horizon clipping (z = 0 intersection + circular rim clamping for z < 0)
  let started = false;
  let prevOnRim = false;
  let prevRimTheta = 0;

  const emitRimPoint = (ux: number, uy: number) => {
    const theta = Math.atan2(uy, ux);
    if (started && prevOnRim) {
      let dTheta = theta - prevRimTheta;
      while (dTheta > Math.PI) dTheta -= Math.PI * 2;
      while (dTheta < -Math.PI) dTheta += Math.PI * 2;
      const absD = Math.abs(dTheta);
      if (absD > 0.07 && absD < Math.PI * 0.95) {
        const steps = Math.min(24, Math.ceil(absD / 0.07));
        for (let s = 1; s < steps; s++) {
          const a = prevRimTheta + (dTheta * s) / steps;
          ctx.lineTo(cx + radius * Math.cos(a), cy - radius * Math.sin(a));
        }
      }
    }
    const sx = cx + radius * ux;
    const sy = cy - radius * uy;
    if (!started) {
      ctx.moveTo(sx, sy);
      started = true;
    } else {
      ctx.lineTo(sx, sy);
    }
    prevOnRim = true;
    prevRimTheta = theta;
  };

  for (let i = 0; i < len; i++) {
    const prevIdx = i === 0 ? len - 1 : i - 1;
    const rx1 = SCRATCH_RX[prevIdx];
    const ry1 = SCRATCH_RY[prevIdx];
    const z1 = SCRATCH_RZ[prevIdx];
    const rx2 = SCRATCH_RX[i];
    const ry2 = SCRATCH_RY[i];
    const z2 = SCRATCH_RZ[i];

    if ((z1 >= 0 && z2 < 0) || (z1 < 0 && z2 >= 0)) {
      const denom = z1 - z2;
      const t = Math.abs(denom) > 1e-9 ? z1 / denom : 0.5;
      const ix = rx1 + t * (rx2 - rx1);
      const iy = ry1 + t * (ry2 - ry1);
      const inv = 1 / (Math.hypot(ix, iy) || 1);
      emitRimPoint(ix * inv, iy * inv);
    }

    if (z2 >= 0) {
      const sx = cx + radius * rx2;
      const sy = cy - radius * ry2;
      if (!started) {
        ctx.moveTo(sx, sy);
        started = true;
      } else {
        ctx.lineTo(sx, sy);
      }
      prevOnRim = false;
    } else {
      const inv = 1 / (Math.hypot(rx2, ry2) || 1);
      emitRimPoint(rx2 * inv, ry2 * inv);
    }
  }

  if (started) {
    ctx.closePath();
  }
}

function tracePolygonStrokeOnSphere(
  ctx: CanvasRenderingContext2D,
  poly: PrecomputedPolygon,
  cx: number,
  cy: number,
  radius: number,
  sinLon0: number,
  cosLon0: number,
  sinLat0: number,
  cosLat0: number,
  camVx: number,
  camVy: number,
  camVz: number
): void {
  const centerCosC = poly.cx3 * camVx + poly.cy3 * camVy + poly.cz3 * camVz;
  if (centerCosC < -poly.sinRadius) return;

  const pts = poly.points;
  const n = pts.length;
  if (n < 2) return;

  const isAnt = poly.isAntarctica;

  // Fast path: entire polygon is on the visible front hemisphere
  if (centerCosC > poly.sinRadius && !isAnt) {
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const rx = p.vx * cosLon0 - p.vz * sinLon0;
      const rz = p.vx * sinLon0 + p.vz * cosLon0;
      const ry = p.vy * cosLat0 - rz * sinLat0;
      const sx = cx + radius * rx;
      const sy = cy - radius * ry;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    return;
  }

  // Clip stroke strictly to visible hemisphere (z >= 0) so horizon rim is never stroked
  let penDown = false;
  let prevRx = 0;
  let prevRy = 0;
  let prevZ = -1;
  let prevValid = false;

  for (let i = 0; i < n; i++) {
    const p = pts[i];
    if (isAnt && p.lat < -88.2) {
      penDown = false;
      prevValid = false;
      continue;
    }

    const rx = p.vx * cosLon0 - p.vz * sinLon0;
    const rz = p.vx * sinLon0 + p.vz * cosLon0;
    const ry = p.vy * cosLat0 - rz * sinLat0;
    const z = p.vy * sinLat0 + rz * cosLat0;

    if (prevValid && ((prevZ >= 0 && z < 0) || (prevZ < 0 && z >= 0))) {
      const denom = prevZ - z;
      const t = Math.abs(denom) > 1e-9 ? prevZ / denom : 0.5;
      const ix = prevRx + t * (rx - prevRx);
      const iy = prevRy + t * (ry - prevRy);
      const inv = 1 / (Math.hypot(ix, iy) || 1);
      const sx = cx + radius * ix * inv;
      const sy = cy - radius * iy * inv;
      if (prevZ >= 0) {
        ctx.lineTo(sx, sy);
        penDown = false;
      } else {
        ctx.moveTo(sx, sy);
        penDown = true;
      }
    }

    if (z >= 0) {
      const sx = cx + radius * rx;
      const sy = cy - radius * ry;
      if (!penDown) {
        ctx.moveTo(sx, sy);
        penDown = true;
      } else {
        ctx.lineTo(sx, sy);
      }
    } else {
      penDown = false;
    }

    prevRx = rx;
    prevRy = ry;
    prevZ = z;
    prevValid = true;
  }
}

function normalizeLon(lon: number): number {
  let l = lon;
  while (l > 180) l -= 360;
  while (l < -180) l += 360;
  return l;
}

function clampLat(lat: number): number {
  return Math.max(-78, Math.min(78, lat));
}

function computeViewportBbox(
  centerLon: number,
  centerLat: number,
  zoom: number
): [number, number, number, number] {
  const halfSpanLon = Math.min(175, Math.max(12, 72 / zoom));
  const halfSpanLat = Math.min(82, Math.max(10, 52 / zoom));
  const minLon = Math.max(-180, Number((centerLon - halfSpanLon).toFixed(2)));
  const maxLon = Math.min(180, Number((centerLon + halfSpanLon).toFixed(2)));
  const minLat = Math.max(-90, Number((centerLat - halfSpanLat).toFixed(2)));
  const maxLat = Math.min(90, Number((centerLat + halfSpanLat).toFixed(2)));
  return [minLon, minLat, maxLon, maxLat];
}

function formatTelemetryString(lon: number, lat: number, zoom: number): string {
  const latStr = lat >= 0 ? `${lat.toFixed(1)}°N` : `${Math.abs(lat).toFixed(1)}°S`;
  const lonStr = lon >= 0 ? `${lon.toFixed(1)}°E` : `${Math.abs(lon).toFixed(1)}°W`;
  return `CAM ${latStr}, ${lonStr} · ${zoom.toFixed(2)}x`;
}

export const GlobeCanvas: React.FC<GlobeCanvasProps> = ({
  events,
  selectedEvent,
  onSelectEvent,
  onViewportBboxChange,
  useBboxFilter,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bgCanvasRef = useRef<{
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    dpr: number;
    radius: number;
  } | null>(null);

  const sizeRef = useRef({ width: 880, height: 620, dpr: 1 });
  const engineDotRef = useRef<HTMLSpanElement | null>(null);
  const engineTextRef = useRef<HTMLSpanElement | null>(null);
  const telemetryPillRef = useRef<HTMLDivElement | null>(null);

  const cameraRef = useRef({
    lon: 25,
    lat: 18,
    zoom: 1.08,
    velLon: 0,
    velLat: 0,
    targetLon: null as number | null,
    targetLat: null as number | null,
    targetZoom: null as number | null,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragMoved: false,
  });

  const markersRef = useRef<ProjectedMarker[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const hoveredIdRef = useRef<string | null>(null);

  const [hoveredEvent, setHoveredEvent] = useState<{
    event: HazardEvent;
    x: number;
    y: number;
    lon: number;
    lat: number;
  } | null>(null);

  // Precompute 3D unit vectors for all events only when `events` array changes
  const precomputedEvents = useMemo<PrecomputedEventRenderData[]>(() => {
    return events.map((ev) => {
      const meta = getCategoryMeta(ev.category);
      const latestObs = ev.observations[0];
      const repCoord = getRepresentativeCoord(latestObs?.geom);
      const repPoint = repCoord ? toVec3(repCoord[0], repCoord[1]) : null;

      const polygons: Vec3Point[][] = [];
      const lines: Vec3Point[][] = [];
      const pointTrack: Vec3Point[] = [];

      const obsSlice = ev.observations.slice(0, 12);
      for (let i = obsSlice.length - 1; i >= 0; i--) {
        const geom = obsSlice[i].geom;
        if (geom.type === 'Polygon' && geom.coordinates[0]?.length) {
          polygons.push(geom.coordinates[0].map(([lon, lat]) => toVec3(lon, lat)));
        } else if (geom.type === 'LineString' && geom.coordinates.length > 1) {
          lines.push(geom.coordinates.slice(0, 20).map(([lon, lat]) => toVec3(lon, lat)));
        } else if (geom.type === 'Point') {
          pointTrack.push(toVec3(geom.coordinates[0], geom.coordinates[1]));
        }
      }
      if (pointTrack.length > 1) {
        lines.push(pointTrack);
      }

      return {
        event: ev,
        meta,
        repPoint,
        polygons,
        lines,
      };
    });
  }, [events]);

  const setEngineHudState = useCallback((active: boolean) => {
    if (engineDotRef.current) {
      engineDotRef.current.className = `engine-dot ${
        active ? 'engine-dot-active' : 'engine-dot-idle'
      }`;
    }
    if (engineTextRef.current) {
      engineTextRef.current.textContent = active
        ? 'On-Demand 3D (Rendering Frame)'
        : 'On-Demand 3D (Idle — ~0% GPU)';
    }
  }, []);

  const updateTelemetryDom = useCallback(() => {
    if (telemetryPillRef.current) {
      const cam = cameraRef.current;
      telemetryPillRef.current.textContent = formatTelemetryString(cam.lon, cam.lat, cam.zoom);
    }
  }, []);

  const emitCurrentBbox = useCallback(() => {
    const cam = cameraRef.current;
    const bbox = computeViewportBbox(cam.lon, cam.lat, cam.zoom);
    onViewportBboxChange(bbox);
  }, [onViewportBboxChange]);

  const getOrBuildBackgroundCanvas = useCallback(
    (width: number, height: number, dpr: number, radius: number): HTMLCanvasElement => {
      const cached = bgCanvasRef.current;
      if (
        cached &&
        cached.width === width &&
        cached.height === height &&
        cached.dpr === dpr &&
        Math.abs(cached.radius - radius) < 0.5
      ) {
        return cached.canvas;
      }

      const offCanvas = cached?.canvas ?? document.createElement('canvas');
      offCanvas.width = Math.max(1, Math.round(width * dpr));
      offCanvas.height = Math.max(1, Math.round(height * dpr));
      const bctx = offCanvas.getContext('2d');
      if (bctx) {
        bctx.save();
        bctx.scale(dpr, dpr);
        const cx = width * 0.5;
        const cy = height * 0.5;

        // 1. Deep space radial background
        const bgGrad = bctx.createRadialGradient(
          cx,
          cy,
          radius * 0.2,
          cx,
          cy,
          Math.max(width, height)
        );
        bgGrad.addColorStop(0, '#0B1325');
        bgGrad.addColorStop(0.55, '#070B16');
        bgGrad.addColorStop(1, '#04070E');
        bctx.fillStyle = bgGrad;
        bctx.fillRect(0, 0, width, height);

        // 2. Outer atmospheric Rayleigh halo
        const haloGrad = bctx.createRadialGradient(cx, cy, radius * 0.94, cx, cy, radius * 1.16);
        haloGrad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
        haloGrad.addColorStop(0.45, 'rgba(99, 102, 241, 0.09)');
        haloGrad.addColorStop(1, 'rgba(6, 9, 17, 0)');
        bctx.fillStyle = haloGrad;
        bctx.beginPath();
        bctx.arc(cx, cy, radius * 1.16, 0, Math.PI * 2);
        bctx.fill();

        // 3. Realistic bathymetric ocean sphere body
        const sphereGrad = bctx.createRadialGradient(
          cx - radius * 0.28,
          cy - radius * 0.28,
          radius * 0.06,
          cx,
          cy,
          radius
        );
        sphereGrad.addColorStop(0, '#122B4D');
        sphereGrad.addColorStop(0.55, '#0B1A33');
        sphereGrad.addColorStop(0.88, '#081224');
        sphereGrad.addColorStop(1, '#050B16');
        bctx.fillStyle = sphereGrad;
        bctx.beginPath();
        bctx.arc(cx, cy, radius, 0, Math.PI * 2);
        bctx.fill();

        bctx.restore();
      }

      bgCanvasRef.current = {
        canvas: offCanvas,
        width,
        height,
        dpr,
        radius,
      };
      return offCanvas;
    },
    []
  );

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const { width, height, dpr } = sizeRef.current;
    const targetW = Math.max(1, Math.round(width * dpr));
    const targetH = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const cam = cameraRef.current;
    const cx = width * 0.5;
    const cy = height * 0.5;
    const baseRadius = Math.min(width, height) * 0.39;
    const radius = baseRadius * cam.zoom;

    // Blit pre-rendered background & ocean sphere gradients in < 0.1ms
    const bgCanvas = getOrBuildBackgroundCanvas(width, height, dpr, radius);
    ctx.save();
    ctx.drawImage(bgCanvas, 0, 0);
    ctx.scale(dpr, dpr);

    // Compute camera rotation trigonometry and 3D camera direction vector ONCE for the frame
    const lambda0 = cam.lon * DEG_TO_RAD;
    const phi0 = cam.lat * DEG_TO_RAD;
    const sinLon0 = Math.sin(lambda0);
    const cosLon0 = Math.cos(lambda0);
    const sinLat0 = Math.sin(phi0);
    const cosLat0 = Math.cos(phi0);
    const camVx = cosLat0 * sinLon0;
    const camVy = sinLat0;
    const camVz = cosLat0 * cosLon0;

    // Clip inside sphere
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // 4. 3D Graticule Grid (batched into a single stroke call)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.09)';
    ctx.lineWidth = 0.75;
    ctx.beginPath();

    for (let m = 0; m < PRECOMPUTED_MERIDIANS.length; m++) {
      const line = PRECOMPUTED_MERIDIANS[m];
      let started = false;
      for (let i = 0; i < line.length; i++) {
        const p = line[i];
        const rx = p.vx * cosLon0 - p.vz * sinLon0;
        const rz = p.vx * sinLon0 + p.vz * cosLon0;
        const cosC = p.vy * sinLat0 + rz * cosLat0;
        if (cosC >= 0) {
          const sx = cx + radius * rx;
          const sy = cy - radius * (p.vy * cosLat0 - rz * sinLat0);
          if (!started) {
            ctx.moveTo(sx, sy);
            started = true;
          } else {
            ctx.lineTo(sx, sy);
          }
        } else {
          started = false;
        }
      }
    }

    for (let pIdx = 0; pIdx < PRECOMPUTED_PARALLELS.length; pIdx++) {
      const line = PRECOMPUTED_PARALLELS[pIdx];
      let started = false;
      for (let i = 0; i < line.length; i++) {
        const p = line[i];
        const rx = p.vx * cosLon0 - p.vz * sinLon0;
        const rz = p.vx * sinLon0 + p.vz * cosLon0;
        const cosC = p.vy * sinLat0 + rz * cosLat0;
        if (cosC >= 0) {
          const sx = cx + radius * rx;
          const sy = cy - radius * (p.vy * cosLat0 - rz * sinLat0);
          if (!started) {
            ctx.moveTo(sx, sy);
            started = true;
          } else {
            ctx.lineTo(sx, sy);
          }
        } else {
          started = false;
        }
      }
    }
    ctx.stroke();

    // Equator highlight
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    let eqStarted = false;
    for (let i = 0; i < PRECOMPUTED_EQUATOR.length; i++) {
      const p = PRECOMPUTED_EQUATOR[i];
      const rx = p.vx * cosLon0 - p.vz * sinLon0;
      const rz = p.vx * sinLon0 + p.vz * cosLon0;
      const cosC = p.vy * sinLat0 + rz * cosLat0;
      if (cosC >= 0) {
        const sx = cx + radius * rx;
        const sy = cy - radius * (p.vy * cosLat0 - rz * sinLat0);
        if (!eqStarted) {
          ctx.moveTo(sx, sy);
          eqStarted = true;
        } else {
          ctx.lineTo(sx, sy);
        }
      } else {
        eqStarted = false;
      }
    }
    ctx.stroke();

    // 5. Realistic Natural Earth 50m Country & Island Polygons (Batched by Biome + Exact Horizon Clipping)
    for (let palIdx = 0; palIdx < BIOME_PALETTES.length; palIdx++) {
      const group = PRECOMPUTED_BY_PALETTE[palIdx];
      if (group.length === 0) continue;
      const palette = BIOME_PALETTES[palIdx];

      // Batched Fill Pass
      ctx.fillStyle = palette.fill;
      ctx.beginPath();
      for (let i = 0; i < group.length; i++) {
        tracePolygonFillOnSphere(
          ctx,
          group[i],
          cx,
          cy,
          radius,
          sinLon0,
          cosLon0,
          sinLat0,
          cosLat0,
          camVx,
          camVy,
          camVz
        );
      }
      ctx.fill();

      // Batched Coastline & Country Border Stroke Pass
      ctx.strokeStyle = palette.stroke;
      ctx.lineWidth = cam.zoom >= 1.4 ? 1.05 : 0.85;
      ctx.beginPath();
      for (let i = 0; i < group.length; i++) {
        tracePolygonStrokeOnSphere(
          ctx,
          group[i],
          cx,
          cy,
          radius,
          sinLon0,
          cosLon0,
          sinLat0,
          cosLat0,
          camVx,
          camVy,
          camVz
        );
      }
      ctx.stroke();
    }

    // 5b. Major Inland Seas & Great Lakes (Natural Earth 110m Lakes)
    ctx.fillStyle = '#0A1930';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let i = 0; i < PRECOMPUTED_LAKES.length; i++) {
      tracePolygonFillOnSphere(
        ctx,
        PRECOMPUTED_LAKES[i],
        cx,
        cy,
        radius,
        sinLon0,
        cosLon0,
        sinLat0,
        cosLat0,
        camVx,
        camVy,
        camVz
      );
    }
    ctx.fill();
    ctx.stroke();

    // 5c. Cartographic Region, Ocean & Country Labels (LOD by Zoom + Collision Avoidance)
    const placedBoxes: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    for (let i = 0; i < PRECOMPUTED_LABELS.length; i++) {
      const item = PRECOMPUTED_LABELS[i];
      const { label, point, displayText } = item;
      if (cam.zoom < label.minZoom) continue;

      const rx = point.vx * cosLon0 - point.vz * sinLon0;
      const rz = point.vx * sinLon0 + point.vz * cosLon0;
      const cosC = point.vy * sinLat0 + rz * cosLat0;
      // Fade out labels smoothly before reaching the horizon limb
      if (cosC < 0.32) continue;

      const sx = cx + radius * rx;
      const sy = cy - radius * (point.vy * cosLat0 - rz * sinLat0);

      let halfW = displayText.length * 3.1;
      let halfH = 6;
      if (label.kind === 'continent' || label.kind === 'region') {
        halfW = displayText.length * 3.8;
        halfH = 8;
      }

      const box = {
        x1: sx - halfW,
        y1: sy - halfH,
        x2: sx + halfW,
        y2: sy + halfH,
      };

      let collides = false;
      for (let b = 0; b < placedBoxes.length; b++) {
        const eb = placedBoxes[b];
        if (box.x1 < eb.x2 && box.x2 > eb.x1 && box.y1 < eb.y2 && box.y2 > eb.y1) {
          collides = true;
          break;
        }
      }
      if (collides) continue;
      placedBoxes.push(box);

      const alpha = Math.min(1, (cosC - 0.32) * 2.2);
      if (label.kind === 'continent' || label.kind === 'region') {
        ctx.font = '700 10px "Space Grotesk", sans-serif';
        ctx.fillStyle = `rgba(186, 230, 253, ${(0.56 * alpha).toFixed(2)})`;
      } else if (label.kind === 'ocean') {
        ctx.font = '500 9px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = `rgba(56, 189, 248, ${(0.34 * alpha).toFixed(2)})`;
      } else {
        ctx.font = '600 9.5px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = `rgba(226, 232, 240, ${(0.72 * alpha).toFixed(2)})`;
      }
      ctx.fillText(displayText, sx - halfW * 0.85, sy + 3);
    }

    // 6. Plot Event Geometries (Polygons, LineStrings, and Points)
    const nextMarkers: ProjectedMarker[] = [];
    const selectedId = selectedEvent?.id;

    for (let eIdx = 0; eIdx < precomputedEvents.length; eIdx++) {
      const item = precomputedEvents[eIdx];
      const { event: ev, meta, repPoint, polygons, lines } = item;
      const isSelected = selectedId === ev.id;

      // Polygons
      for (let pIdx = 0; pIdx < polygons.length; pIdx++) {
        const ring = polygons[pIdx];
        ctx.beginPath();
        let anyVis = false;
        for (let i = 0; i < ring.length; i++) {
          const p = ring[i];
          const rx = p.vx * cosLon0 - p.vz * sinLon0;
          const rz = p.vx * sinLon0 + p.vz * cosLon0;
          const cosC = p.vy * sinLat0 + rz * cosLat0;
          if (cosC >= 0) anyVis = true;
          const sx = cx + radius * rx;
          const sy = cy - radius * (p.vy * cosLat0 - rz * sinLat0);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        if (anyVis) {
          ctx.closePath();
          ctx.fillStyle = meta.bgSubtle;
          ctx.fill();
          ctx.strokeStyle = meta.color;
          ctx.lineWidth = isSelected ? 2.4 : 1.5;
          ctx.stroke();
        }
      }

      // Storm track lines
      if (lines.length > 0 && (isSelected || lines[0].length > 1)) {
        for (let lIdx = 0; lIdx < lines.length; lIdx++) {
          const line = lines[lIdx];
          ctx.beginPath();
          let started = false;
          for (let i = 0; i < line.length; i++) {
            const p = line[i];
            const rx = p.vx * cosLon0 - p.vz * sinLon0;
            const rz = p.vx * sinLon0 + p.vz * cosLon0;
            const cosC = p.vy * sinLat0 + rz * cosLat0;
            if (cosC >= 0) {
              const sx = cx + radius * rx;
              const sy = cy - radius * (p.vy * cosLat0 - rz * sinLat0);
              if (!started) {
                ctx.moveTo(sx, sy);
                started = true;
              } else {
                ctx.lineTo(sx, sy);
              }
            } else {
              started = false;
            }
          }
          ctx.strokeStyle = meta.color;
          ctx.lineWidth = isSelected ? 2.6 : 1.6;
          ctx.stroke();
        }
      }

      // Representative point marker
      if (repPoint) {
        const rx = repPoint.vx * cosLon0 - repPoint.vz * sinLon0;
        const rz = repPoint.vx * sinLon0 + repPoint.vz * cosLon0;
        const cosC = repPoint.vy * sinLat0 + rz * cosLat0;
        if (cosC >= 0) {
          const sx = cx + radius * rx;
          const sy = cy - radius * (repPoint.vy * cosLat0 - rz * sinLat0);

          nextMarkers.push({
            event: ev,
            x: sx,
            y: sy,
            lon: repPoint.lon,
            lat: repPoint.lat,
            color: meta.color,
          });

          if (ev.status === 'open' || isSelected) {
            ctx.beginPath();
            ctx.arc(sx, sy, isSelected ? 16 : 10.5, 0, Math.PI * 2);
            ctx.fillStyle = meta.bgSubtle;
            ctx.fill();
            ctx.strokeStyle = isSelected ? '#F8FAFC' : meta.borderSubtle;
            ctx.lineWidth = isSelected ? 1.8 : 1;
            ctx.stroke();
          }

          ctx.beginPath();
          ctx.arc(sx, sy, isSelected ? 7 : 5, 0, Math.PI * 2);
          ctx.fillStyle = meta.color;
          ctx.fill();
          ctx.strokeStyle = '#060911';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          if (isSelected) {
            ctx.strokeStyle = '#38BDF8';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(sx, sy, 21, 0, Math.PI * 2);
            ctx.stroke();

            ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
            const label = ev.title.length > 34 ? ev.title.slice(0, 32) + '…' : ev.title;
            const textWidth = ctx.measureText(label).width;
            const boxX = sx + 14;
            const boxY = sy - 12;
            ctx.fillStyle = 'rgba(6, 9, 17, 0.88)';
            ctx.fillRect(boxX, boxY - 11, textWidth + 12, 20);
            ctx.strokeStyle = meta.color;
            ctx.lineWidth = 1;
            ctx.strokeRect(boxX, boxY - 11, textWidth + 12, 20);
            ctx.fillStyle = '#F8FAFC';
            ctx.fillText(label, boxX + 6, boxY + 2);
          }
        }
      }
    }

    markersRef.current = nextMarkers;
    ctx.restore();

    // 7. Crisp rim border
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.38)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.restore();
  }, [precomputedEvents, selectedEvent, getOrBuildBackgroundCanvas]);

  const scheduleOnDemandLoop = useCallback(() => {
    if (rafIdRef.current !== null) return;
    setEngineHudState(true);

    const step = () => {
      const cam = cameraRef.current;
      let needsNextFrame = false;

      if (cam.targetLon !== null && cam.targetLat !== null) {
        let dLon = cam.targetLon - cam.lon;
        while (dLon > 180) dLon -= 360;
        while (dLon < -180) dLon += 360;
        const dLat = cam.targetLat - cam.lat;
        const dZoom = (cam.targetZoom ?? cam.zoom) - cam.zoom;

        if (Math.abs(dLon) > 0.25 || Math.abs(dLat) > 0.25 || Math.abs(dZoom) > 0.01) {
          cam.lon = normalizeLon(cam.lon + dLon * 0.18);
          cam.lat = clampLat(cam.lat + dLat * 0.18);
          cam.zoom = cam.zoom + dZoom * 0.18;
          needsNextFrame = true;
        } else {
          cam.lon = cam.targetLon;
          cam.lat = cam.targetLat;
          if (cam.targetZoom !== null) cam.zoom = cam.targetZoom;
          cam.targetLon = null;
          cam.targetLat = null;
          cam.targetZoom = null;
          emitCurrentBbox();
        }
      } else if (!cam.isDragging && (Math.abs(cam.velLon) > 0.03 || Math.abs(cam.velLat) > 0.03)) {
        cam.lon = normalizeLon(cam.lon + cam.velLon);
        cam.lat = clampLat(cam.lat + cam.velLat);
        cam.velLon *= 0.89;
        cam.velLat *= 0.89;
        needsNextFrame = true;
        if (Math.abs(cam.velLon) <= 0.03 && Math.abs(cam.velLat) <= 0.03) {
          cam.velLon = 0;
          cam.velLat = 0;
          emitCurrentBbox();
        }
      }

      drawFrame();
      updateTelemetryDom();

      if (needsNextFrame || cam.isDragging) {
        rafIdRef.current = window.requestAnimationFrame(step);
      } else {
        rafIdRef.current = null;
        setEngineHudState(false);
      }
    };

    rafIdRef.current = window.requestAnimationFrame(step);
  }, [drawFrame, emitCurrentBbox, setEngineHudState, updateTelemetryDom]);

  // Measure container size via ResizeObserver (avoids layout thrashing inside rAF)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      sizeRef.current = {
        width: Math.max(320, Math.round(rect.width || 880)),
        height: Math.max(260, Math.round(rect.height || 620)),
        dpr,
      };
      drawFrame();
    };

    updateSize();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateSize());
      observer.observe(container);
      return () => {
        observer.disconnect();
        if (rafIdRef.current !== null) {
          window.cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      };
    } else {
      window.addEventListener('resize', updateSize);
      return () => {
        window.removeEventListener('resize', updateSize);
        if (rafIdRef.current !== null) {
          window.cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      };
    }
  }, [drawFrame]);

  // Redraw single frame when events or selectedEvent changes
  useEffect(() => {
    drawFrame();
  }, [drawFrame]);

  // Smooth fly-to when selectedEvent changes
  useEffect(() => {
    if (!selectedEvent) return;
    const coord = getRepresentativeCoord(selectedEvent.observations[0]?.geom);
    if (!coord) return;
    const [targetLon, targetLat] = coord;
    cameraRef.current.targetLon = normalizeLon(targetLon);
    cameraRef.current.targetLat = clampLat(targetLat);
    cameraRef.current.targetZoom = Math.max(cameraRef.current.zoom, 1.32);
    cameraRef.current.velLon = 0;
    cameraRef.current.velLat = 0;
    scheduleOnDemandLoop();
  }, [selectedEvent, scheduleOnDemandLoop]);

  // Emit initial bbox when bbox filter is enabled
  useEffect(() => {
    if (useBboxFilter) {
      emitCurrentBbox();
    }
  }, [useBboxFilter, emitCurrentBbox]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cam = cameraRef.current;
    cam.isDragging = true;
    cam.dragMoved = false;
    cam.dragStartX = e.clientX;
    cam.dragStartY = e.clientY;
    cam.targetLon = null;
    cam.targetLat = null;
    cam.velLon = 0;
    cam.velLat = 0;
    if (hoveredIdRef.current !== null) {
      hoveredIdRef.current = null;
      setHoveredEvent(null);
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore in synthetic test environments
    }
    scheduleOnDemandLoop();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cam = cameraRef.current;
    if (cam.isDragging) {
      const dx = e.clientX - cam.dragStartX;
      const dy = e.clientY - cam.dragStartY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        cam.dragMoved = true;
      }
      const sensitivity = 0.25 / cam.zoom;
      const stepLon = -dx * sensitivity;
      const stepLat = dy * sensitivity;
      cam.lon = normalizeLon(cam.lon + stepLon);
      cam.lat = clampLat(cam.lat + stepLat);
      cam.velLon = cam.velLon * 0.35 + stepLon * 0.65;
      cam.velLat = cam.velLat * 0.35 + stepLat * 0.65;
      cam.dragStartX = e.clientX;
      cam.dragStartY = e.clientY;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    // Hover hit test on markers
    let closest: ProjectedMarker | null = null;
    let minDist = 16;
    const markers = markersRef.current;
    for (let i = 0; i < markers.length; i++) {
      const m = markers[i];
      const dist = Math.hypot(m.x - localX, m.y - localY);
      if (dist < minDist) {
        minDist = dist;
        closest = m;
      }
    }
    if (closest) {
      if (hoveredIdRef.current !== closest.event.id) {
        hoveredIdRef.current = closest.event.id;
        setHoveredEvent({
          event: closest.event,
          x: closest.x,
          y: closest.y,
          lon: closest.lon,
          lat: closest.lat,
        });
      }
    } else if (hoveredIdRef.current !== null) {
      hoveredIdRef.current = null;
      setHoveredEvent(null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cam = cameraRef.current;
    const wasMoved = cam.dragMoved;
    cam.isDragging = false;

    if (!wasMoved && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      let clicked: ProjectedMarker | null = null;
      let minDist = 18;
      const markers = markersRef.current;
      for (let i = 0; i < markers.length; i++) {
        const m = markers[i];
        const dist = Math.hypot(m.x - localX, m.y - localY);
        if (dist < minDist) {
          minDist = dist;
          clicked = m;
        }
      }
      if (clicked) {
        soundFx.playSelect();
        onSelectEvent(clicked.event);
      }
    } else {
      updateTelemetryDom();
      emitCurrentBbox();
    }
    scheduleOnDemandLoop();
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const cam = cameraRef.current;
    const delta = e.deltaY < 0 ? 0.14 : -0.14;
    cam.zoom = Math.max(0.75, Math.min(3.0, Number((cam.zoom + delta).toFixed(2))));
    updateTelemetryDom();
    drawFrame();
    emitCurrentBbox();
  };

  const handleZoomStep = (delta: number) => {
    soundFx.playFilter();
    const cam = cameraRef.current;
    cam.zoom = Math.max(0.75, Math.min(3.0, Number((cam.zoom + delta).toFixed(2))));
    updateTelemetryDom();
    drawFrame();
    emitCurrentBbox();
  };

  const handleResetGlobe = () => {
    soundFx.playFilter();
    cameraRef.current.targetLon = 25;
    cameraRef.current.targetLat = 18;
    cameraRef.current.targetZoom = 1.08;
    scheduleOnDemandLoop();
  };

  return (
    <div
      ref={containerRef}
      className="globe-stage"
      data-testid="globe-container"
      aria-label="Interactive 3D Earth Hazard Globe"
    >
      <canvas
        ref={canvasRef}
        className="globe-canvas"
        data-testid="globe-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />

      {/* Top-Left Telemetry & Render Engine Pill (Updated via DOM refs for 0 React re-renders during drag) */}
      <div className="globe-hud-top-left">
        <div className="globe-engine-pill" data-testid="render-mode-indicator">
          <span ref={engineDotRef} className="engine-dot engine-dot-idle" />
          <span ref={engineTextRef}>On-Demand 3D (Idle — ~0% GPU)</span>
        </div>
        <div ref={telemetryPillRef} className="globe-coords-pill mono-text">
          CAM 18.0°N, 25.0°E · 1.08x
        </div>
      </div>

      {/* Bottom-Left Category Legend (Color + Icon for NFR-06 Accessibility) */}
      <div className="globe-legend" aria-label="Hazard Category Legend">
        {Object.values(CATEGORY_MAP)
          .slice(0, 5)
          .map((cat) => {
            const Icon = cat.Icon;
            return (
              <div key={cat.id} className="legend-item">
                <span className="legend-swatch" style={{ backgroundColor: cat.color }}>
                  <Icon size={11} />
                </span>
                <span className="legend-label">{cat.label}</span>
              </div>
            );
          })}
      </div>

      {/* Bottom-Right Zoom & Camera Controls */}
      <div className="globe-controls" role="group" aria-label="3D Globe Camera Controls">
        <button
          type="button"
          className="globe-ctrl-btn"
          onClick={() => handleZoomStep(0.2)}
          aria-label="Zoom In Globe"
          title="Zoom In"
        >
          +
        </button>
        <button
          type="button"
          className="globe-ctrl-btn"
          onClick={() => handleZoomStep(-0.2)}
          aria-label="Zoom Out Globe"
          title="Zoom Out"
        >
          −
        </button>
        <button
          type="button"
          className="globe-ctrl-btn globe-ctrl-reset"
          onClick={handleResetGlobe}
          aria-label="Reset Globe Camera"
          title="Reset Camera Orientation"
        >
          Reset
        </button>
      </div>

      {/* Hover Tooltip */}
      {hoveredEvent && (
        <div
          className="globe-tooltip"
          style={{
            left: `${Math.min(hoveredEvent.x + 14, 520)}px`,
            top: `${Math.max(hoveredEvent.y - 24, 16)}px`,
          }}
        >
          <div className="globe-tooltip-header">
            <span
              className="globe-tooltip-cat"
              style={{ color: getCategoryMeta(hoveredEvent.event.category).color }}
            >
              {getCategoryMeta(hoveredEvent.event.category).shortLabel.toUpperCase()}
            </span>
            <span className="mono-text">{hoveredEvent.event.id}</span>
          </div>
          <div className="globe-tooltip-title">{hoveredEvent.event.title}</div>
          <div className="globe-tooltip-coords mono-text">
            {formatWgs84([hoveredEvent.lon, hoveredEvent.lat])}
          </div>
        </div>
      )}
    </div>
  );
};
