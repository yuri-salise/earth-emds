import React from 'react';
import { HealthStatus } from '../types/domain';
import { formatUtcTimestamp } from '../utils/categories';

interface FreshnessBannerProps {
  health: HealthStatus;
  showDisclaimersModal: boolean;
  onCloseDisclaimers: () => void;
}

export const FreshnessBanner: React.FC<FreshnessBannerProps> = ({
  health,
  showDisclaimersModal,
  onCloseDisclaimers,
}) => {
  const isFallback =
    health.cache_freshness === 'cached_fallback' ||
    health.cache_freshness === 'stale' ||
    health.status === 'degraded' ||
    health.providers?.newsapi?.outcome === 'rate_limited';

  return (
    <>
      {isFallback && (
        <div
          className="degraded-banner"
          role="status"
          aria-live="polite"
          data-testid="freshness-banner"
        >
          <div className="degraded-banner-left">
            <span className="degraded-badge">CACHED SNAPSHOT ACTIVE</span>
            <span>
              Serving verified cached telemetry snapshot (Last successful sync:{' '}
              <strong className="mono-text">{formatUtcTimestamp(health.last_updated_at)}</strong>).
              Upstream API delays or rate limits never interrupt exploration.
            </span>
          </div>
          <div className="degraded-providers mono-text">
            <span>EONET: {health.providers?.eonet?.outcome || 'cached'}</span>
            <span>·</span>
            <span>REST COUNTRIES: {health.providers?.rest_countries?.outcome || 'cached'}</span>
            <span>·</span>
            <span>NEWSAPI: {health.providers?.newsapi?.outcome || 'cached'}</span>
          </div>
        </div>
      )}

      {showDisclaimersModal && (
        <div
          className="disclaimers-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="disclaimers-modal-title"
          data-testid="disclaimers-modal"
        >
          <div className="disclaimers-modal-card">
            <div className="disclaimers-modal-header">
              <div>
                <span className="modal-kicker mono-text">MANDATORY TRANSPARENCY &amp; USE BOUNDARY</span>
                <h2 id="disclaimers-modal-title" className="modal-title">
                  Scientific, Demographic &amp; News Uncertainty Disclaimers
                </h2>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={onCloseDisclaimers}
                aria-label="Close Data Disclaimers dialog"
              >
                ✕
              </button>
            </div>

            <div className="disclaimers-modal-body">
              <div className="disclaimer-callout disclaimer-boundary">
                <strong>Educational &amp; Informational Use Boundary:</strong> This platform is
                strictly an informational monitoring and educational learning system. It is{' '}
                <strong>not</strong> an emergency alerting, disaster prediction, casualty
                estimation, evacuation routing, or incident command service.
              </div>

              <div className="disclaimer-grid">
                <div className="disclaimer-box">
                  <div className="disclaimer-box-title">
                    1. Satellite Geometry Approximation (NASA EONET v3)
                  </div>
                  <p>
                    Event coordinates and perimeters from NASA EONET v3 are approximate
                    satellite/agency observations and may reflect upstream reporting delays. Do not
                    use for local emergency navigation.
                  </p>
                </div>

                <div className="disclaimer-box">
                  <div className="disclaimer-box-title">
                    2. National Population Density Caveat (REST Countries v3.1)
                  </div>
                  <p>
                    Population density is a national macro-level average calculated from REST
                    Countries v3.1 (National Population ÷ Total Land Area in km²) and does not
                    measure local population exposure inside the hazard footprint.
                  </p>
                </div>

                <div className="disclaimer-box">
                  <div className="disclaimer-box-title">
                    3. Contextual News Matching Caveat (NewsAPI v2)
                  </div>
                  <p>
                    News articles from NewsAPI v2 are matched contextually by hazard keywords,
                    country/place names, and publication dates—not by verified GPS coordinates
                    inside the disaster area.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
