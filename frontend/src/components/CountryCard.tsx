import React from 'react';
import { MatchedCountry } from '../types/domain';
import { formatUtcTimestamp } from '../utils/categories';

interface CountryCardProps {
  country: MatchedCountry;
}

export const CountryCard: React.FC<CountryCardProps> = ({ country }) => {
  const currencyEntries = Object.entries(country.currencies || {});
  const currencyLabel =
    currencyEntries.length > 0
      ? currencyEntries
          .map(([code, info]) =>
            info?.symbol ? `${code} — ${info.name} (${info.symbol})` : `${code} — ${info.name}`
          )
          .join(', ')
      : 'Not reported';

  const isCoastal = country.match_method === 'coastal_proximity';

  return (
    <div className="country-profile-card" data-testid={`country-card-${country.iso_a3}`}>
      <div className="country-card-header">
        <div>
          <h4 className="country-name">{country.name}</h4>
          <div className="country-iso-row mono-text">
            <span>ISO-3: {country.iso_a3}</span>
            {country.iso_a2 && (
              <>
                <span>·</span>
                <span>ISO-2: {country.iso_a2}</span>
              </>
            )}
          </div>
        </div>

        <span
          className={`match-method-badge ${
            isCoastal ? 'match-method-coastal' : 'match-method-intersects'
          }`}
          data-testid={`country-match-method-${country.iso_a3}`}
        >
          {isCoastal ? 'Coastal Proximity (100km)' : 'Spatial Intersection'}
        </span>
      </div>

      <dl className="country-metrics-grid">
        <div className="metric-box">
          <dt className="metric-label">National Population</dt>
          <dd className="metric-value mono-text">
            {country.population !== null && country.population !== undefined
              ? country.population.toLocaleString('en-US')
              : 'Not reported'}
          </dd>
        </div>

        <div className="metric-box">
          <dt className="metric-label">Total Land Area</dt>
          <dd className="metric-value mono-text">
            {country.area_sq_km !== null && country.area_sq_km !== undefined
              ? `${country.area_sq_km.toLocaleString('en-US')} km²`
              : 'Not reported'}
          </dd>
        </div>

        <div className="metric-box metric-box-wide">
          <dt className="metric-label">Derived Population Density (Macro-Level)</dt>
          <dd
            className="metric-value metric-density-highlight mono-text"
            data-testid={`country-density-${country.iso_a3}`}
          >
            {country.population_density !== null && country.population_density !== undefined
              ? `National Average (${country.population_density.toLocaleString('en-US')} people/km²)`
              : 'Not available (missing or zero land area)'}
          </dd>
        </div>

        <div className="metric-box metric-box-wide">
          <dt className="metric-label">Official Currency</dt>
          <dd className="metric-value">{currencyLabel}</dd>
        </div>
      </dl>

      <div className="country-card-footer mono-text">
        <span>Provider: REST Countries v3.1 + Natural Earth 1:10m</span>
        <span>Retrieved: {formatUtcTimestamp(country.retrieved_at)}</span>
      </div>
    </div>
  );
};
