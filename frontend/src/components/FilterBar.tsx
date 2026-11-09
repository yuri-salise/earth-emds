import React, { useEffect, useRef } from 'react';
import { EventFilters } from '../types/domain';
import { FILTER_CATEGORIES, getCategoryMeta } from '../utils/categories';
import { soundFx } from '../utils/soundFx';

interface FilterBarProps {
  filters: EventFilters;
  onChangeFilters: (next: EventFilters) => void;
  onResetFilters: () => void;
  totalCount: number;
  liteMode: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onChangeFilters,
  onResetFilters,
  totalCount,
  liteMode,
}) => {
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCategoryClick = (categoryId: string) => {
    soundFx.playFilter();
    onChangeFilters({
      ...filters,
      category: categoryId,
    });
  };

  const handleStatusClick = (statusVal: 'all' | 'open' | 'closed') => {
    soundFx.playFilter();
    onChangeFilters({
      ...filters,
      status: statusVal,
    });
  };

  const handleToggleBbox = () => {
    soundFx.playFilter();
    onChangeFilters({
      ...filters,
      useBbox: !filters.useBbox,
    });
  };

  const hasActiveFilters =
    filters.q.trim() !== '' ||
    filters.category !== 'all' ||
    filters.status !== 'all' ||
    filters.start_date !== '' ||
    filters.end_date !== '' ||
    filters.useBbox;

  return (
    <section className="filter-bar" aria-label="Hazard Event Search and Filters">
      <div className="filter-row-primary">
        {/* Search Input with '/' shortcut hint */}
        <div className="search-input-wrapper">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="search-icon"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchInputRef}
            type="search"
            className="search-input"
            placeholder="Search hazard events, countries, ISO codes… (Press '/' to focus)"
            aria-label="Search hazard events"
            data-testid="search-input"
            value={filters.q}
            onChange={(e) =>
              onChangeFilters({
                ...filters,
                q: e.target.value,
              })
            }
          />
          <kbd className="search-kbd mono-text" aria-hidden="true">
            /
          </kbd>
        </div>

        {/* Category Pills */}
        <div className="category-pills" role="group" aria-label="Filter by hazard category">
          {FILTER_CATEGORIES.map((cat) => {
            const isSelected = filters.category === cat.id;
            const meta = cat.id === 'all' ? null : getCategoryMeta(cat.id);
            const Icon = meta?.Icon;
            return (
              <button
                key={cat.id}
                type="button"
                className={`category-pill ${isSelected ? 'category-pill-active' : ''}`}
                style={
                  isSelected && meta
                    ? {
                        borderColor: meta.color,
                        backgroundColor: meta.bgSubtle,
                        color: '#F8FAFC',
                      }
                    : undefined
                }
                aria-pressed={isSelected}
                data-testid={`category-filter-${cat.id}`}
                onClick={() => handleCategoryClick(cat.id)}
              >
                {Icon && (
                  <span style={{ color: meta?.color, display: 'inline-flex' }}>
                    <Icon size={13} />
                  </span>
                )}
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="filter-row-secondary">
        {/* Status Segmented Control */}
        <div className="status-toggle-group" role="group" aria-label="Filter by event status">
          {(['all', 'open', 'closed'] as const).map((st) => {
            const active = filters.status === st;
            return (
              <button
                key={st}
                type="button"
                className={`status-toggle-btn ${active ? 'status-toggle-active' : ''}`}
                aria-pressed={active}
                data-testid={`status-filter-${st}`}
                onClick={() => handleStatusClick(st)}
              >
                {st === 'all' ? 'All Status' : st === 'open' ? 'Open' : 'Closed'}
              </button>
            );
          })}
        </div>

        {/* Date Range Inputs */}
        <div className="date-range-group">
          <label className="date-field-label" htmlFor="filter-start-date">
            <span className="date-label-text">From</span>
            <input
              id="filter-start-date"
              type="date"
              className="date-input mono-text"
              aria-label="Start date"
              data-testid="start-date-input"
              value={filters.start_date}
              onChange={(e) => {
                soundFx.playFilter();
                onChangeFilters({
                  ...filters,
                  start_date: e.target.value,
                });
              }}
            />
          </label>
          <span className="date-separator" aria-hidden="true">
            →
          </span>
          <label className="date-field-label" htmlFor="filter-end-date">
            <span className="date-label-text">To</span>
            <input
              id="filter-end-date"
              type="date"
              className="date-input mono-text"
              aria-label="End date"
              data-testid="end-date-input"
              value={filters.end_date}
              onChange={(e) => {
                soundFx.playFilter();
                onChangeFilters({
                  ...filters,
                  end_date: e.target.value,
                });
              }}
            />
          </label>
        </div>

        {/* Viewport BBox Filter Toggle */}
        <button
          type="button"
          className={`bbox-toggle-btn ${filters.useBbox ? 'bbox-toggle-active' : ''}`}
          onClick={handleToggleBbox}
          aria-pressed={filters.useBbox}
          disabled={liteMode}
          data-testid="bbox-filter-toggle"
          title={
            liteMode
              ? 'Switch to 3D Globe Mode to filter by current camera viewport bounding box'
              : 'Filter events to the current 3D globe camera bounding box (bbox)'
          }
        >
          <span>Filter by Current Globe Viewport (bbox)</span>
          {filters.useBbox && filters.bbox && (
            <span className="bbox-coords-chip mono-text">
              [{filters.bbox.map((v) => v.toFixed(0)).join(', ')}]
            </span>
          )}
        </button>

        {/* Event Count & Reset */}
        <div className="filter-summary-right">
          <span className="event-count-badge mono-text" data-testid="showing-events-count">
            Showing {totalCount} {totalCount === 1 ? 'event' : 'events'}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              className="reset-filters-btn"
              onClick={() => {
                soundFx.playFilter();
                onResetFilters();
              }}
              data-testid="reset-filters-button"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
