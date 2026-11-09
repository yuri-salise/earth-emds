import React, { useEffect } from 'react';
import { HazardEvent, ScoredArticle } from '../types/domain';
import {
  formatUtcTimestamp,
  formatWgs84,
  getCategoryMeta,
  getRepresentativeCoord,
} from '../utils/categories';
import { soundFx } from '../utils/soundFx';
import { ArticleList } from './ArticleList';
import { CountryCard } from './CountryCard';

interface EventDetailDrawerProps {
  event: HazardEvent | null;
  articles: ScoredArticle[];
  isLoadingArticles: boolean;
  onClose: () => void;
}

export const EventDetailDrawer: React.FC<EventDetailDrawerProps> = ({
  event,
  articles,
  isLoadingArticles,
  onClose,
}) => {
  useEffect(() => {
    if (!event) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundFx.playDrawerClose();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [event, onClose]);

  if (!event) return null;

  const meta = getCategoryMeta(event.category);
  const Icon = meta.Icon;
  const latestObs = event.observations[0];

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
            {event.status === 'open' && <span className="radar-pulse-dot" />}
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

      <div className="drawer-scroll-content">
        <h2 id="drawer-event-title" className="drawer-main-title">
          {event.title}
        </h2>

        {/* SECTION 1: NASA EONET v3 Telemetry & Observation History */}
        <section className="drawer-section" aria-labelledby="drawer-telemetry-heading">
          <div className="drawer-section-header">
            <span className="section-kicker mono-text">SECTION 01 // SATELLITE TELEMETRY</span>
            <h3 id="drawer-telemetry-heading" className="drawer-section-title">
              NASA EONET v3 Telemetry &amp; Observation History
            </h3>
          </div>

          {/* Mandatory Satellite Geometry Approximation Disclaimer Badge */}
          <div
            className="disclaimer-badge disclaimer-geometry"
            role="note"
            data-testid="disclaimer-satellite-geometry"
          >
            <strong>Satellite Geometry Caveat:</strong> Event coordinates and perimeters from NASA
            EONET v3 are approximate satellite/agency observations and may reflect upstream
            reporting delays. Do not use for local emergency navigation.
          </div>

          <dl className="telemetry-summary-grid">
            <div className="telemetry-cell">
              <dt className="metric-label">Event Identifier</dt>
              <dd className="metric-value mono-text">{event.id}</dd>
            </div>
            <div className="telemetry-cell">
              <dt className="metric-label">Latest Magnitude</dt>
              <dd className="metric-value mono-text" data-testid="drawer-magnitude-value">
                {magnitudeDisplay}
              </dd>
            </div>
            <div className="telemetry-cell">
              <dt className="metric-label">First Observed</dt>
              <dd className="metric-value mono-text">{formatUtcTimestamp(event.first_seen_at)}</dd>
            </div>
            <div className="telemetry-cell">
              <dt className="metric-label">
                {event.status === 'closed' ? 'Closed Timestamp' : 'Last Synchronized'}
              </dt>
              <dd className="metric-value mono-text">
                {formatUtcTimestamp(
                  event.status === 'closed' && event.closed_at
                    ? event.closed_at
                    : event.last_updated_at
                )}
              </dd>
            </div>
          </dl>

          {/* Coordinate Observation Timeline (Point, LineString, Polygon in WGS 84 [lon, lat]) */}
          <div className="observations-timeline-box">
            <h4 className="sub-heading">
              WGS 84 Coordinate Timeline ([lon, lat] · {event.observations.length}{' '}
              {event.observations.length === 1 ? 'Observation' : 'Observations'})
            </h4>
            <ul className="observation-list" data-testid="observation-timeline">
              {event.observations.map((obs) => {
                const rep = getRepresentativeCoord(obs.geom);
                const mag =
                  obs.magnitude_value !== null && obs.magnitude_value !== undefined
                    ? `${obs.magnitude_value} ${obs.magnitude_unit || ''}`.trim()
                    : 'Magnitude not reported';
                return (
                  <li key={String(obs.id)} className="observation-item">
                    <div className="observation-item-top">
                      <span className="geom-type-badge mono-text">{obs.geom.type}</span>
                      <time className="observation-time mono-text" dateTime={obs.observed_at}>
                        {formatUtcTimestamp(obs.observed_at)}
                      </time>
                    </div>
                    <div className="observation-coords mono-text">
                      {rep ? formatWgs84(rep) : 'Coordinates N/A'}
                      {obs.geom.type === 'LineString' && (
                        <span> · {obs.geom.coordinates.length} track waypoints</span>
                      )}
                      {obs.geom.type === 'Polygon' && (
                        <span> · {obs.geom.coordinates[0]?.length || 0} perimeter vertices</span>
                      )}
                    </div>
                    <div className="observation-mag mono-text">{mag}</div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Official NASA / Agency Source Links */}
          <div className="sources-box">
            <h4 className="sub-heading">Official NASA &amp; Agency Provenance Links</h4>
            {event.sources.length === 0 ? (
              <p className="muted-note">No external agency URLs attached to this EONET record.</p>
            ) : (
              <div className="source-links-row">
                {event.sources.map((src) => (
                  <a
                    key={`${src.id}-${src.url}`}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="source-link-pill"
                    data-testid="official-source-link"
                  >
                    <span className="mono-text">{src.id}</span>
                    {src.title && <span className="source-title-text">— {src.title}</span>}
                    <span aria-hidden="true">↗</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* SECTION 2: Matched Country Profile Cards */}
        <section className="drawer-section" aria-labelledby="drawer-country-heading">
          <div className="drawer-section-header">
            <span className="section-kicker mono-text">
              SECTION 02 // POSTGIS &amp; REST COUNTRIES v3.1
            </span>
            <h3 id="drawer-country-heading" className="drawer-section-title">
              Matched Country Profiles &amp; Macro Demographics
            </h3>
          </div>

          {/* Mandatory National Population Density Disclaimer Badge */}
          <div
            className="disclaimer-badge disclaimer-density"
            role="note"
            data-testid="disclaimer-national-density"
          >
            <strong>National Population Density Caveat:</strong> Population density is a national
            macro-level average calculated from REST Countries v3.1 (National Population ÷ Total
            Land Area in km²) and does not measure local population exposure inside the hazard
            footprint.
          </div>

          {event.countries.length === 0 ? (
            <div className="open-ocean-card" data-testid="no-country-matches-card">
              <div className="open-ocean-title">
                No Sovereign Country Profile Matched (Open Ocean / Offshore Event)
              </div>
              <p>
                This hazard geometry lies outside sovereign administrative polygons (Natural Earth
                Admin 0 1:10m) and beyond the 100 km coastal proximity buffer (`ST_DWithin`). Full
                NASA EONET v3 satellite telemetry remains available above.
              </p>
            </div>
          ) : (
            <div className="countries-stack" data-testid="matched-countries-list">
              {event.countries.map((country) => (
                <CountryCard key={country.iso_a3} country={country} />
              ))}
            </div>
          )}
        </section>

        {/* SECTION 3: Ranked News Coverage & Rule-Based Evidence */}
        <ArticleList articles={articles} isLoading={isLoadingArticles} />
      </div>
    </aside>
  );
};
