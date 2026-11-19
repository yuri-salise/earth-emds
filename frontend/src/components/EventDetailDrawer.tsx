import React, { useEffect, useRef, useState } from 'react';
import { HazardEvent, ScoredArticle } from '../types/domain';
import {
  formatUtcTimestamp,
  formatWgs84,
  getCategoryMeta,
  getEarliestObservation,
  getLatestObservation,
  getRepresentativeCoord,
  safeExternalUrl,
} from '../utils/categories';
import { soundFx } from '../utils/soundFx';
import { ArticleList } from './ArticleList';
import { CountryCard } from './CountryCard';

interface EventDetailDrawerProps {
  event: HazardEvent | null;
  articles: ScoredArticle[];
  isLoadingArticles: boolean;
  onClose: () => void;
  disableEscapeClose?: boolean;
}

export const EventDetailDrawer: React.FC<EventDetailDrawerProps> = React.memo(({
  event,
  articles,
  isLoadingArticles,
  onClose,
  disableEscapeClose = false,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [showAllObservations, setShowAllObservations] = useState<boolean>(false);

  useEffect(() => {
    if (!event || disableEscapeClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundFx.playDrawerClose();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [event, onClose, disableEscapeClose]);

  useEffect(() => {
    setShowAllObservations(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [event?.id]);

  if (!event) return null;

  const meta = getCategoryMeta(event.category);
  const Icon = meta.Icon;
  const latestObs = getLatestObservation(event.observations);
  const earliestObs = getEarliestObservation(event.observations);
  const visibleObservations = showAllObservations
    ? event.observations
    : event.observations.slice(0, 3);
  const hiddenObsCount = event.observations.length - visibleObservations.length;

  const magnitudeDisplay =
    latestObs && latestObs.magnitude_value !== null && latestObs.magnitude_value !== undefined
      ? `${latestObs.magnitude_value.toLocaleString('en-US')}${
          latestObs.magnitude_unit ? ` ${latestObs.magnitude_unit}` : ''
        }`
      : 'Not reported';

  return (
    <aside
      className="event-detail-drawer"
      role="dialog"
      aria-modal="false"
      aria-labelledby="drawer-event-title"
      data-testid="event-detail-drawer"
    >
      {/* Sticky Drawer Header */}
      <div className="drawer-header">
        <div className="drawer-header-meta">
          <span
            className="category-badge"
            style={{
              color: meta.color,
              backgroundColor: meta.bgSubtle,
              borderColor: meta.borderSubtle,
            }}
          >
            <Icon size={14} />
            <span>{meta.label}</span>
          </span>
          <span
            className={`status-pill ${
              event.status === 'open' ? 'status-pill-open' : 'status-pill-closed'
            }`}
          >
            {event.status === 'open' && <span className="radar-pulse-dot" aria-hidden="true" />}
            <span>{event.status.toUpperCase()}</span>
          </span>
          <span className="drawer-event-id mono-text" data-testid="drawer-event-id">
            {event.id}
          </span>
        </div>

        <button
          type="button"
          className="drawer-close-btn"
          onClick={() => {
            soundFx.playDrawerClose();
            onClose();
          }}
          aria-label="Close Event Detail Drawer"
          data-testid="close-drawer-button"
        >
          ✕
        </button>
      </div>

      <div ref={scrollContainerRef} className="drawer-scroll-content">
        <h2 id="drawer-event-title" className="drawer-main-title">
          {event.title}
        </h2>

        {/* SECTION 1: Satellite Telemetry & Observation History */}
        <section className="drawer-section" aria-labelledby="drawer-telemetry-heading">
          <div className="drawer-section-header">
            <h3 id="drawer-telemetry-heading" className="drawer-section-title">
              Telemetry
            </h3>
            <span className="section-source-tag mono-text">NASA EONET v3</span>
          </div>

          <dl className="telemetry-summary-grid">
            <div className="telemetry-cell">
              <dt className="metric-label">Magnitude</dt>
              <dd className="metric-value mono-text" data-testid="drawer-magnitude-value">
                {magnitudeDisplay}
              </dd>
            </div>
            <div className="telemetry-cell">
              <dt className="metric-label">
                {event.status === 'closed' ? 'Closed' : 'Latest Update'}
              </dt>
              <dd className="metric-value mono-text">
                {formatUtcTimestamp(
                  event.status === 'closed' && event.closed_at
                    ? event.closed_at
                    : latestObs?.observed_at || event.last_updated_at
                )}
              </dd>
            </div>
            <div className="telemetry-cell">
              <dt className="metric-label">First Observed</dt>
              <dd className="metric-value mono-text">
                {formatUtcTimestamp(earliestObs?.observed_at || event.first_seen_at)}
              </dd>
            </div>
            <div className="telemetry-cell">
              <dt className="metric-label">Observations</dt>
              <dd className="metric-value mono-text">{event.observations.length}</dd>
            </div>
          </dl>

          {/* Compact Coordinate Observation Timeline */}
          <div className="observations-timeline-box">
            <h4 className="sub-heading">Coordinates (WGS 84)</h4>
            <ul className="observation-list" data-testid="observation-timeline">
              {visibleObservations.map((obs, idx) => {
                const rep = getRepresentativeCoord(obs.geom);
                const mag =
                  obs.magnitude_value !== null && obs.magnitude_value !== undefined
                    ? `${obs.magnitude_value.toLocaleString('en-US')} ${obs.magnitude_unit || ''}`.trim()
                    : null;
                return (
                  <li key={`${obs.id}-${obs.observed_at}-${idx}`} className="observation-item">
                    <div className="observation-item-top">
                      <span className="geom-type-badge mono-text">
                        {obs.geom.type}
                        {mag ? ` · ${mag}` : ''}
                      </span>
                      <time className="observation-time mono-text" dateTime={obs.observed_at}>
                        {formatUtcTimestamp(obs.observed_at)}
                      </time>
                    </div>
                    <div className="observation-coords mono-text">
                      {rep ? formatWgs84(rep) : 'Coordinates N/A'}
                      {obs.geom.type === 'LineString' && (
                        <span> · {obs.geom.coordinates.length} pts</span>
                      )}
                      {obs.geom.type === 'Polygon' && (
                        <span> · {obs.geom.coordinates[0]?.length || 0} vertices</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {hiddenObsCount > 0 && (
              <button
                type="button"
                className="timeline-expand-btn"
                onClick={() => setShowAllObservations(true)}
              >
                Show {hiddenObsCount} earlier {hiddenObsCount === 1 ? 'observation' : 'observations'}
              </button>
            )}
            {showAllObservations && event.observations.length > 3 && (
              <button
                type="button"
                className="timeline-expand-btn"
                onClick={() => setShowAllObservations(false)}
              >
                Show fewer
              </button>
            )}
          </div>

          {/* Official NASA / Agency Source Links */}
          {event.sources.length > 0 && (
            <div className="sources-box">
              <h4 className="sub-heading">Sources</h4>
              <div className="source-links-row">
                {event.sources.map((src) => {
                  const href = safeExternalUrl(src.url);
                  if (!href) return null;
                  return (
                    <a
                      key={`${src.id}-${src.url}`}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="source-link-pill"
                      data-testid="official-source-link"
                    >
                      <span className="mono-text">{src.id}</span>
                      {src.title && <span className="source-title-text">— {src.title}</span>}
                      <span aria-hidden="true">↗</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Concise Satellite Geometry Footnote */}
          <p
            className="inline-caveat-note"
            role="note"
            data-testid="disclaimer-satellite-geometry"
          >
            Coordinates are approximate satellite/agency observations; not for emergency navigation.
          </p>
        </section>

        {/* SECTION 2: Matched Country Profile Cards */}
        <section className="drawer-section" aria-labelledby="drawer-country-heading">
          <div className="drawer-section-header">
            <h3 id="drawer-country-heading" className="drawer-section-title">
              Country Context
            </h3>
            <span className="section-source-tag mono-text">REST Countries v3.1</span>
          </div>

          {event.countries.length === 0 ? (
            <div className="open-ocean-card" data-testid="no-country-matches-card">
              <div className="open-ocean-title">No Sovereign Country Profile Matched</div>
              <p>Open-ocean event outside the 100 km coastal buffer.</p>
            </div>
          ) : (
            <div className="countries-stack" data-testid="matched-countries-list">
              {event.countries.map((country) => (
                <CountryCard key={country.iso_a3} country={country} />
              ))}
            </div>
          )}

          {/* Concise National Population Density Footnote */}
          <p
            className="inline-caveat-note"
            role="note"
            data-testid="disclaimer-national-density"
          >
            Density is a national macro-level average calculated from REST Countries v3.1, not local
            hazard exposure.
          </p>
        </section>

        {/* SECTION 3: Ranked News Coverage & Rule-Based Evidence */}
        <ArticleList articles={articles} isLoading={isLoadingArticles} />
      </div>
    </aside>
  );
});
