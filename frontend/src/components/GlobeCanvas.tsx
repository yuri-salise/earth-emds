import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HazardEvent } from '../types/domain';
import {
  CATEGORY_MAP,
  formatWgs84,
  getCategoryMeta,
  getRepresentativeCoord,
} from '../utils/categories';
import { soundFx } from '../utils/soundFx';
import { WORLD_LANDMASSES } from '../utils/worldLandmarks';

interface GlobeCanvasProps {
  events: HazardEvent[];
  selectedEvent: HazardEvent | null;
  onSelectEvent: (event: HazardEvent) => void;
  onViewportBboxChange: (bbox: [number, number, number, number]) => void;
  useBboxFilter: boolean;
}

interface ProjectedMarker {
  event: HazardEvent;
  x: number;
  y: number;
  lon: number;
  lat: number;
  color: string;
}

const DEG_TO_RAD = Math.PI / 180;

function normalizeLon(lon: number): number {
  let l = lon;
  while (l > 180) l -= 360;
  while (l < -180) l += 360;
  return l;
}

function clampLat(lat: number): number {
  return Math.max(-78, Math.min(78, lat));
}

function projectPoint3D(
  lon: number,
  lat: number,
  centerLon: number,
  centerLat: number,
  radius: number,
  cx: number,
  cy: number
): { x: number; y: number; z: number; visible: boolean } {
  const lambda = lon * DEG_TO_RAD;
  const phi = lat * DEG_TO_RAD;
  const lambda0 = centerLon * DEG_TO_RAD;
  const phi0 = centerLat * DEG_TO_RAD;

  const dLambda = lambda - lambda0;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const cosPhi0 = Math.cos(phi0);
  const sinPhi0 = Math.sin(phi0);
  const cosDLambda = Math.cos(dLambda);

  const cosC = sinPhi0 * sinPhi + cosPhi0 * cosPhi * cosDLambda;
  const x = cx + radius * cosPhi * Math.sin(dLambda);
  const y = cy - radius * (cosPhi0 * sinPhi - sinPhi0 * cosPhi * cosDLambda);

  return {
    x,
    y,
    z: cosC,
    visible: cosC >= -0.05,
  };
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

export const GlobeCanvas: React.FC<GlobeCanvasProps> = ({
  events,
  selectedEvent,
  onSelectEvent,
  onViewportBboxChange,
  useBboxFilter,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  const [hoveredEvent, setHoveredEvent] = useState<{
    event: HazardEvent;
    x: number;
    y: number;
    lon: number;
    lat: number;
  } | null>(null);
  const [isActivelyRendering, setIsActivelyRendering] = useState<boolean>(false);
  const [cameraTelemetry, setCameraTelemetry] = useState({
    lon: 25,
    lat: 18,
    zoom: 1.08,
  });

  const emitCurrentBbox = useCallback(() => {
    const cam = cameraRef.current;
    const bbox = computeViewportBbox(cam.lon, cam.lat, cam.zoom);
    onViewportBboxChange(bbox);
  }, [onViewportBboxChange]);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 600;

    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const cam = cameraRef.current;
    const cx = width * 0.5;
    const cy = height * 0.5;
    const baseRadius = Math.min(width, height) * 0.39;
    const radius = baseRadius * cam.zoom;

    // 1. Deep space radial gradient
    const bgGrad = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, Math.max(width, height));
    bgGrad.addColorStop(0, '#0B1325');
    bgGrad.addColorStop(0.55, '#070B16');
    bgGrad.addColorStop(1, '#04070E');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Outer atmospheric halo
    const haloGrad = ctx.createRadialGradient(cx, cy, radius * 0.94, cx, cy, radius * 1.15);
    haloGrad.addColorStop(0, 'rgba(56, 189, 248, 0.22)');
    haloGrad.addColorStop(0.45, 'rgba(99, 102, 241, 0.08)');
    haloGrad.addColorStop(1, 'rgba(6, 9, 17, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.15, 0, Math.PI * 2);
    ctx.fill();

    // 3. Globe ocean sphere body
    const sphereGrad = ctx.createRadialGradient(
      cx - radius * 0.28,
      cy - radius * 0.28,
      radius * 0.08,
      cx,
      cy,
      radius
    );
    sphereGrad.addColorStop(0, '#13233F');
    sphereGrad.addColorStop(0.65, '#0B1528');
    sphereGrad.addColorStop(1, '#060B16');
    ctx.fillStyle = sphereGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Clip inside sphere for graticules, landmasses, and geometries
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // 4. 3D Graticule Grid (every 20 degrees)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.11)';
    ctx.lineWidth = 0.8;

    for (let lon = -180; lon < 180; lon += 20) {
      ctx.beginPath();
      let started = false;
      for (let lat = -80; lat <= 80; lat += 5) {
        const pt = projectPoint3D(lon, lat, cam.lon, cam.lat, radius, cx, cy);
        if (pt.visible) {
          if (!started) {
            ctx.moveTo(pt.x, pt.y);
            started = true;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }

    for (let lat = -60; lat <= 60; lat += 20) {
      ctx.beginPath();
      let started = false;
      for (let lon = -180; lon <= 180; lon += 5) {
        const pt = projectPoint3D(lon, lat, cam.lon, cam.lat, radius, cx, cy);
        if (pt.visible) {
          if (!started) {
            ctx.moveTo(pt.x, pt.y);
            started = true;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        } else {
          started = false;
        }
      }
      ctx.stroke();
    }

    // Equator highlight
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    let eqStarted = false;
    for (let lon = -180; lon <= 180; lon += 4) {
      const pt = projectPoint3D(lon, 0, cam.lon, cam.lat, radius, cx, cy);
      if (pt.visible) {
        if (!eqStarted) {
          ctx.moveTo(pt.x, pt.y);
          eqStarted = true;
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      } else {
        eqStarted = false;
      }
    }
    ctx.stroke();

    // 5. Continental & Island Vector Landmasses
    for (const land of WORLD_LANDMASSES) {
      ctx.beginPath();
      let visibleCount = 0;
      land.coordinates.forEach(([lon, lat], idx) => {
        const pt = projectPoint3D(lon, lat, cam.lon, cam.lat, radius, cx, cy);
        if (pt.visible) visibleCount++;
        if (idx === 0) {
          ctx.moveTo(pt.x, pt.y);
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      });
      if (visibleCount > 1) {
        ctx.closePath();
        ctx.fillStyle = 'rgba(30, 41, 59, 0.72)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // 6. Plot Event Geometries (Polygons, LineStrings, and Points)
    const nextMarkers: ProjectedMarker[] = [];

    for (const ev of events) {
      const meta = getCategoryMeta(ev.category);
      const isSelected = selectedEvent?.id === ev.id;
      const latestObs = ev.observations[0];

      // Draw all observations so storm tracks & perimeters show movement history
      for (let i = ev.observations.length - 1; i >= 0; i--) {
        const obs = ev.observations[i];
        const geom = obs.geom;

        if (geom.type === 'Polygon' && geom.coordinates[0]?.length) {
          const ring = geom.coordinates[0];
          ctx.beginPath();
          let anyVis = false;
          ring.forEach(([lon, lat], idx) => {
            const pt = projectPoint3D(lon, lat, cam.lon, cam.lat, radius, cx, cy);
            if (pt.visible) anyVis = true;
            if (idx === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          if (anyVis) {
            ctx.closePath();
            ctx.fillStyle = meta.bgSubtle;
            ctx.fill();
            ctx.strokeStyle = meta.color;
            ctx.lineWidth = isSelected ? 2.4 : 1.5;
            ctx.stroke();
          }
        } else if (geom.type === 'LineString' && geom.coordinates.length > 1) {
          ctx.beginPath();
          let started = false;
          const pts: Array<{ x: number; y: number; visible: boolean }> = [];
          for (const [lon, lat] of geom.coordinates) {
            const pt = projectPoint3D(lon, lat, cam.lon, cam.lat, radius, cx, cy);
            pts.push(pt);
            if (pt.visible) {
              if (!started) {
                ctx.moveTo(pt.x, pt.y);
                started = true;
              } else {
                ctx.lineTo(pt.x, pt.y);
              }
            } else {
              started = false;
            }
          }
          ctx.strokeStyle = meta.color;
          ctx.lineWidth = isSelected ? 2.8 : 2.0;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Draw directional waypoint nodes along storm track
          for (const p of pts) {
            if (p.visible) {
              ctx.beginPath();
              ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
              ctx.fillStyle = '#0B1120';
              ctx.fill();
              ctx.strokeStyle = meta.color;
              ctx.lineWidth = 1.5;
              ctx.stroke();
            }
          }
        }
      }

      // Primary representative marker for selection & hit-testing
      const repCoord = getRepresentativeCoord(latestObs?.geom);
      if (repCoord) {
        const [lon, lat] = repCoord;
        const proj = projectPoint3D(lon, lat, cam.lon, cam.lat, radius, cx, cy);
        if (proj.visible) {
          nextMarkers.push({
            event: ev,
            x: proj.x,
            y: proj.y,
            lon,
            lat,
            color: meta.color,
          });

          // Outer radar ring for open events or selected event
          if (ev.status === 'open' || isSelected) {
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, isSelected ? 16 : 11, 0, Math.PI * 2);
            ctx.fillStyle = meta.bgSubtle;
            ctx.fill();
            ctx.strokeStyle = isSelected ? '#F8FAFC' : meta.borderSubtle;
            ctx.lineWidth = isSelected ? 1.8 : 1;
            ctx.stroke();
          }

          // Core marker dot
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, isSelected ? 7 : 5.2, 0, Math.PI * 2);
          ctx.fillStyle = meta.color;
          ctx.fill();
          ctx.strokeStyle = '#060911';
          ctx.lineWidth = 1.6;
          ctx.stroke();

          // Target reticle on selected event
          if (isSelected) {
            ctx.strokeStyle = '#38BDF8';
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, 21, 0, Math.PI * 2);
            ctx.stroke();

            // Label callout on globe
            ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
            const label = ev.title.length > 34 ? ev.title.slice(0, 32) + '…' : ev.title;
            const textWidth = ctx.measureText(label).width;
            const boxX = proj.x + 14;
            const boxY = proj.y - 12;
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
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.restore();
  }, [events, selectedEvent]);

  const scheduleOnDemandLoop = useCallback(() => {
    if (rafIdRef.current !== null) return;
    setIsActivelyRendering(true);

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
          cam.lon = normalizeLon(cam.lon + dLon * 0.16);
          cam.lat = clampLat(cam.lat + dLat * 0.16);
          cam.zoom = cam.zoom + dZoom * 0.16;
          needsNextFrame = true;
        } else {
          cam.lon = cam.targetLon;
          cam.lat = cam.targetLat;
          if (cam.targetZoom !== null) cam.zoom = cam.targetZoom;
          cam.targetLon = null;
          cam.targetLat = null;
          cam.targetZoom = null;
          setCameraTelemetry({
            lon: Number(cam.lon.toFixed(1)),
            lat: Number(cam.lat.toFixed(1)),
            zoom: Number(cam.zoom.toFixed(2)),
          });
          emitCurrentBbox();
        }
      } else if (!cam.isDragging && (Math.abs(cam.velLon) > 0.04 || Math.abs(cam.velLat) > 0.04)) {
        cam.lon = normalizeLon(cam.lon + cam.velLon);
        cam.lat = clampLat(cam.lat + cam.velLat);
        cam.velLon *= 0.88;
        cam.velLat *= 0.88;
        needsNextFrame = true;
        if (Math.abs(cam.velLon) <= 0.04 && Math.abs(cam.velLat) <= 0.04) {
          cam.velLon = 0;
          cam.velLat = 0;
          setCameraTelemetry({
            lon: Number(cam.lon.toFixed(1)),
            lat: Number(cam.lat.toFixed(1)),
            zoom: Number(cam.zoom.toFixed(2)),
          });
          emitCurrentBbox();
        }
      }

      drawFrame();

      if (needsNextFrame || cam.isDragging) {
        rafIdRef.current = window.requestAnimationFrame(step);
      } else {
        rafIdRef.current = null;
        setIsActivelyRendering(false);
      }
    };

    rafIdRef.current = window.requestAnimationFrame(step);
  }, [drawFrame, emitCurrentBbox]);

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

  // Handle container resize on demand
  useEffect(() => {
    const handleResize = () => drawFrame();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [drawFrame]);

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
    e.currentTarget.setPointerCapture(e.pointerId);
    scheduleOnDemandLoop();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    const cam = cameraRef.current;
    if (cam.isDragging) {
      const dx = e.clientX - cam.dragStartX;
      const dy = e.clientY - cam.dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        cam.dragMoved = true;
      }
      const sensitivity = 0.26 / cam.zoom;
      cam.velLon = -dx * sensitivity;
      cam.velLat = dy * sensitivity;
      cam.lon = normalizeLon(cam.lon + cam.velLon);
      cam.lat = clampLat(cam.lat + cam.velLat);
      cam.dragStartX = e.clientX;
      cam.dragStartY = e.clientY;
      setHoveredEvent(null);
      return;
    }

    // Hover hit test on markers
    let closest: ProjectedMarker | null = null;
    let minDist = 16;
    for (const m of markersRef.current) {
      const dist = Math.hypot(m.x - localX, m.y - localY);
      if (dist < minDist) {
        minDist = dist;
        closest = m;
      }
    }
    if (closest) {
      setHoveredEvent({
        event: closest.event,
        x: closest.x,
        y: closest.y,
        lon: closest.lon,
        lat: closest.lat,
      });
    } else if (hoveredEvent !== null) {
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
      for (const m of markersRef.current) {
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
      setCameraTelemetry({
        lon: Number(cam.lon.toFixed(1)),
        lat: Number(cam.lat.toFixed(1)),
        zoom: Number(cam.zoom.toFixed(2)),
      });
      emitCurrentBbox();
    }
    scheduleOnDemandLoop();
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const cam = cameraRef.current;
    const delta = e.deltaY < 0 ? 0.14 : -0.14;
    cam.zoom = Math.max(0.75, Math.min(3.0, Number((cam.zoom + delta).toFixed(2))));
    setCameraTelemetry({
      lon: Number(cam.lon.toFixed(1)),
      lat: Number(cam.lat.toFixed(1)),
      zoom: cam.zoom,
    });
    drawFrame();
    emitCurrentBbox();
  };

  const handleZoomStep = (delta: number) => {
    soundFx.playFilter();
    const cam = cameraRef.current;
    cam.zoom = Math.max(0.75, Math.min(3.0, Number((cam.zoom + delta).toFixed(2))));
    setCameraTelemetry({
      lon: Number(cam.lon.toFixed(1)),
      lat: Number(cam.lat.toFixed(1)),
      zoom: cam.zoom,
    });
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

      {/* Top-Left Telemetry & Render Engine Pill */}
      <div className="globe-hud-top-left">
        <div className="globe-engine-pill" data-testid="render-mode-indicator">
          <span
            className={`engine-dot ${isActivelyRendering ? 'engine-dot-active' : 'engine-dot-idle'}`}
          />
          <span>
            On-Demand 3D {isActivelyRendering ? '(Rendering Frame)' : '(Idle — ~0% GPU)'}
          </span>
        </div>
        <div className="globe-coords-pill mono-text">
          CAM {cameraTelemetry.lat >= 0 ? `${cameraTelemetry.lat}°N` : `${Math.abs(cameraTelemetry.lat)}°S`},{' '}
          {cameraTelemetry.lon >= 0 ? `${cameraTelemetry.lon}°E` : `${Math.abs(cameraTelemetry.lon)}°W`} ·{' '}
          {cameraTelemetry.zoom.toFixed(2)}x
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
