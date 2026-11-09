import React, { useRef } from 'react';
import { HazardEvent } from '../types/domain';
import {
  formatUtcTimestamp,
  formatWgs84,
  getCategoryMeta,
  getRepresentativeCoord,
} from '../utils/categories';
import { soundFx } from '../utils/soundFx';

interface EventSidebarListProps {
  events: HazardEvent[];
  selectedEvent: HazardEvent | null;
  onSelectEvent: (event: HazardEvent) => void;
  isLoading: boolean;
  liteMode: boolean;
}

export const EventSidebarList: React.FC<EventSidebarListProps> = ({
  events,
  selectedEvent,
  onSelectEvent,
  isLoading,
  liteMode,
}) => {
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);

  const handleSelect = (ev: HazardEvent) => {
    soundFx.playSelect();
    onSelectEvent(ev);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    ev: HazardEvent,
    index: number
  ) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect(ev);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (index + 1) % events.length;
      itemRefs.current[nextIndex]?.focus();
      handleSelect(events[nextIndex]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (index - 1 + events.length) % events.length;
      itemRefs.current[prevIndex]?.focus();
      handleSelect(events[prevIndex]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      itemRefs.current[0]?.focus();
      if (events[0]) handleSelect(events[0]);
    } else if (e.key === 'End') {
      e.preventDefault();
      const last = events.length - 1;
      itemRefs.current[last]?.focus();
      if (events[last]) handleSelect(events[last]);
    }
  };

  return (
    <aside
      className={`event-sidebar ${liteMode ? 'event-sidebar-lite-expanded' : ''}`}
      aria-label="Synchronized Hazard Event List"
    >
      <div className="sidebar-header">
        <div className="sidebar-header-left">
          <h2 className="sidebar-title">Active &amp; Recent Hazard Feed</h2>
          <span className="sidebar-count mono-text" data-testid="sidebar-event-count">
            Showing {events.length} {events.length === 1 ? 'event' : 'events'}
          </span>
        </div>
        {liteMode && (
          <div className="lite-mode-active-pill" data-testid="render-mode-indicator">
            <span className="lite-dot" />
            <span>Lite Mode — GPU Off (2D Tactical Grid)</span>
          </div>
        )}
      </div>

      <div className="sidebar-keyboard-hint mono-text">
        <span>Keyboard: ↑/↓ Navigate · Enter/Space Inspect · Esc Close Drawer</span>
      </div>

      {isLoading && events.length === 0 ? (
        <div className="sidebar-empty-state" role="status">
          <p>Loading NASA EONET v3 satellite telemetry…</p>
        </div>
      ) : events.length === 0 ? (
        <div className="sidebar-empty-state" role="status" data-testid="empty-events-state">
          <p>No hazard events match the current filter criteria.</p>
        </div>
      ) : (
        <div
          className={`event-listbox ${liteMode ? 'event-listbox-grid' : ''}`}
          role="listbox"
          aria-label="Natural Hazard Events"
          data-testid="event-listbox"
        >
          {events.map((ev, index) => {
            const isSelected = selectedEvent?.id === ev.id;
            const meta = getCategoryMeta(ev.category);
            const Icon = meta.Icon;
            const latestObs = ev.observations[0];
            const repCoord = getRepresentativeCoord(latestObs?.geom);
            const geomType = latestObs?.geom?.type || 'Point';

            return (
              <div
                key={ev.id}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                role="option"
                tabIndex={0}
                aria-selected={isSelected}
                data-testid={`event-list-item-${ev.id}`}
                className={`event-card ${isSelected ? 'event-card-selected' : ''}`}
                style={{
                  animationDelay: `${Math.min(index * 30, 240)}ms`,
                }}
                onClick={() => handleSelect(ev)}
                onKeyDown={(e) => handleKeyDown(e, ev, index)}
              >
                <div className="event-card-top">
                  {/* Category Badge with Custom SVG Icon + Color */}
                  <span
                    className="category-badge"
                    style={{
                      color: meta.color,
                      backgroundColor: meta.bgSubtle,
                      borderColor: meta.borderSubtle,
                    }}
                  >
                    <Icon size={13} />
                    <span>{meta.label}</span>
                  </span>

                  {/* Status Pill (OPEN / CLOSED) */}
                  <span
                    className={`status-pill ${
                      ev.status === 'open' ? 'status-pill-open' : 'status-pill-closed'
                    }`}
                  >
                    {ev.status === 'open' && <span className="radar-pulse-dot" />}
                    <span>{ev.status.toUpperCase()}</span>
                  </span>
                </div>

                <h3 className="event-card-title">{ev.title}</h3>

                <div className="event-card-meta">
                  <span className="event-id-chip mono-text">{ev.id}</span>
                  <span className="geom-type-chip mono-text">{geomType}</span>
                  <span className="obs-count-chip mono-text">
                    {ev.observations.length}{' '}
                    {ev.observations.length === 1 ? 'observation' : 'observations'}
                  </span>

                  {/* Matched Country ISO Tags */}
                  {ev.countries.length > 0 ? (
                    ev.countries.map((c) => (
                      <span
                        key={c.iso_a3}
                        className="country-iso-tag mono-text"
                        title={`${c.name} (${c.match_method})`}
                      >
                        {c.iso_a3}
                      </span>
                    ))
                  ) : (
                    <span className="country-iso-tag country-iso-ocean mono-text">OPEN OCEAN</span>
                  )}
                </div>

                <div className="event-card-footer mono-text">
                  <span>{repCoord ? formatWgs84(repCoord) : 'Coords N/A'}</span>
                  <span>{formatUtcTimestamp(latestObs?.observed_at || ev.last_updated_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
};
