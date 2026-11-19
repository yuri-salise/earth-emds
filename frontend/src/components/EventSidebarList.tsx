import React, { useRef } from 'react';
import { HazardEvent } from '../types/domain';
import {
  formatUtcTimestamp,
  getCategoryMeta,
  getLatestObservation,
} from '../utils/categories';
import { soundFx } from '../utils/soundFx';

interface EventSidebarListProps {
  events: HazardEvent[];
  selectedEvent: HazardEvent | null;
  onSelectEvent: (event: HazardEvent) => void;
  onResetFilters?: () => void;
  isLoading: boolean;
  liteMode: boolean;
}

export const EventSidebarList: React.FC<EventSidebarListProps> = React.memo(({
  events,
  selectedEvent,
  onSelectEvent,
  onResetFilters,
  isLoading,
  liteMode,
}) => {
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  itemRefs.current.length = events.length;

  const selectedIndex = selectedEvent
    ? events.findIndex((ev) => ev.id === selectedEvent.id)
    : -1;
  const rovingFocusIndex = selectedIndex >= 0 ? selectedIndex : 0;

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
      {liteMode && (
        <div className="sidebar-header">
          <h2 className="sidebar-title">Hazards</h2>
          <div className="lite-mode-active-pill" data-testid="render-mode-indicator">
            <span className="lite-dot" aria-hidden="true" />
            <span>Lite Mode — GPU Off</span>
          </div>
        </div>
      )}

      {isLoading && events.length === 0 ? (
        <div className="sidebar-skeleton-stack" role="status" aria-label="Loading hazard telemetry">
          <span className="sr-only">Loading hazard telemetry…</span>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton-card" aria-hidden="true">
              <div className="skeleton-line skeleton-short" />
              <div className="skeleton-line skeleton-long" />
              <div className="skeleton-line skeleton-med" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="sidebar-empty-state" role="status" data-testid="empty-events-state">
          <p className="empty-state-title">No matching events</p>
          <p className="empty-state-copy">Adjust your search or filters to see hazards.</p>
          {onResetFilters && (
            <button
              type="button"
              className="empty-reset-btn"
              onClick={() => {
                soundFx.playFilter();
                onResetFilters();
              }}
            >
              Reset Filters
            </button>
          )}
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
            const latestObs = getLatestObservation(ev.observations);
            const primaryCountry = ev.countries[0];
            const extraCountries = ev.countries.length > 1 ? ev.countries.length - 1 : 0;

            return (
              <div
                key={ev.id}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                role="option"
                tabIndex={index === rovingFocusIndex ? 0 : -1}
                aria-selected={isSelected}
                data-testid={`event-list-item-${ev.id}`}
                className={`event-card ${isSelected ? 'event-card-selected' : ''}`}
                onClick={() => handleSelect(ev)}
                onKeyDown={(e) => handleKeyDown(e, ev, index)}
              >
                <div className="event-card-top">
                  <span className="category-label-inline" style={{ color: meta.color }}>
                    <Icon size={13} />
                    <span>{meta.shortLabel}</span>
                  </span>

                  <span
                    className={`status-indicator ${
                      ev.status === 'open' ? 'status-indicator-open' : 'status-indicator-closed'
                    }`}
                  >
                    {ev.status === 'open' && <span className="radar-pulse-dot" aria-hidden="true" />}
                    <span>{ev.status === 'open' ? 'Open' : 'Closed'}</span>
                  </span>
                </div>

                <h3 className="event-card-title">{ev.title}</h3>

                <div className="event-card-footer">
                  <span className="card-location-text">
                    {primaryCountry
                      ? `${primaryCountry.name}${extraCountries > 0 ? ` +${extraCountries}` : ''}`
                      : 'Open Ocean'}
                  </span>
                  <span className="card-footer-time mono-text">
                    {formatUtcTimestamp(latestObs?.observed_at || ev.last_updated_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
});
