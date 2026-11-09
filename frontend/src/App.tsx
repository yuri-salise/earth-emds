import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchEventArticles,
  fetchEventDetail,
  fetchEvents,
  fetchHealthStatus,
} from './api/client';
import { FALLBACK_EVENTS, FALLBACK_HEALTH } from './api/fallbackData';
import { EventDetailDrawer } from './components/EventDetailDrawer';
import { EventSidebarList } from './components/EventSidebarList';
import { FilterBar } from './components/FilterBar';
import { FreshnessBanner } from './components/FreshnessBanner';
import { GlobeCanvas } from './components/GlobeCanvas';
import { Header } from './components/Header';
import { EventFilters, HazardEvent, HealthStatus, ScoredArticle } from './types/domain';
import { soundFx } from './utils/soundFx';

const INITIAL_FILTERS: EventFilters = {
  q: '',
  category: 'all',
  status: 'all',
  start_date: '',
  end_date: '',
  useBbox: false,
  bbox: [-160, -65, 165, 70],
};

export const App: React.FC = () => {
  const [filters, setFilters] = useState<EventFilters>(INITIAL_FILTERS);
  const [events, setEvents] = useState<HazardEvent[]>(FALLBACK_EVENTS);
  const [health, setHealth] = useState<HealthStatus>(FALLBACK_HEALTH);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>(FALLBACK_HEALTH.last_updated_at);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const [selectedEvent, setSelectedEvent] = useState<HazardEvent | null>(null);
  const [articles, setArticles] = useState<ScoredArticle[]>([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState<boolean>(false);

  const [liteMode, setLiteMode] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => soundFx.isEnabled());
  const [showDisclaimersModal, setShowDisclaimersModal] = useState<boolean>(false);

  const loadEventsAndHealth = useCallback(
    async (activeFilters: EventFilters, isManualSync = false) => {
      if (isManualSync) {
        setIsSyncing(true);
      } else {
        setIsLoadingEvents(true);
      }

      try {
        const [eventsRes, healthRes] = await Promise.all([
          fetchEvents(activeFilters),
          fetchHealthStatus(),
        ]);
        setEvents(eventsRes.items);
        setLastUpdatedAt(eventsRes.last_updated_at || healthRes.last_updated_at);
        setHealth({
          ...healthRes,
          cache_freshness:
            eventsRes.cache_freshness === 'cached_fallback'
              ? 'cached_fallback'
              : healthRes.cache_freshness,
        });
      } finally {
        setIsLoadingEvents(false);
        setIsSyncing(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadEventsAndHealth(filters, false);
  }, [filters, loadEventsAndHealth]);

  const handleSelectEvent = useCallback(
    async (ev: HazardEvent) => {
      const wasClosed = selectedEvent === null;
      setSelectedEvent(ev);
      if (wasClosed) {
        soundFx.playDrawerOpen();
      }
      setIsLoadingArticles(true);
      try {
        const [detailedEvent, fetchedArticles] = await Promise.all([
          fetchEventDetail(ev.id),
          fetchEventArticles(ev.id),
        ]);
        if (detailedEvent) {
          setSelectedEvent(detailedEvent);
        }
        setArticles(fetchedArticles);
      } finally {
        setIsLoadingArticles(false);
      }
    },
    [selectedEvent]
  );

  const handleSyncNow = () => {
    soundFx.playSyncPing();
    void loadEventsAndHealth(filters, true);
    if (selectedEvent) {
      void fetchEventArticles(selectedEvent.id).then(setArticles);
    }
  };

  const handleToggleLiteMode = () => {
    soundFx.playFilter();
    setLiteMode((prev) => !prev);
  };

  const handleToggleSound = () => {
    const next = soundFx.toggle();
    setSoundEnabled(next);
  };

  const handleViewportBboxChange = useCallback((nextBbox: [number, number, number, number]) => {
    setFilters((prev) => {
      if (!prev.useBbox) {
        return { ...prev, bbox: nextBbox };
      }
      const same =
        prev.bbox &&
        prev.bbox[0] === nextBbox[0] &&
        prev.bbox[1] === nextBbox[1] &&
        prev.bbox[2] === nextBbox[2] &&
        prev.bbox[3] === nextBbox[3];
      if (same) return prev;
      return { ...prev, bbox: nextBbox };
    });
  }, []);

  return (
    <div className="app-shell">
      <Header
        health={health}
        lastUpdatedAt={lastUpdatedAt}
        liteMode={liteMode}
        onToggleLiteMode={handleToggleLiteMode}
        soundEnabled={soundEnabled}
        onToggleSound={handleToggleSound}
        onSyncNow={handleSyncNow}
        isSyncing={isSyncing}
        showDisclaimersModal={showDisclaimersModal}
        onToggleDisclaimersModal={() => {
          soundFx.playFilter();
          setShowDisclaimersModal((prev) => !prev);
        }}
      />

      <FreshnessBanner
        health={health}
        showDisclaimersModal={showDisclaimersModal}
        onCloseDisclaimers={() => {
          soundFx.playDrawerClose();
          setShowDisclaimersModal(false);
        }}
      />

      <FilterBar
        filters={filters}
        onChangeFilters={setFilters}
        onResetFilters={() => setFilters(INITIAL_FILTERS)}
        totalCount={events.length}
        liteMode={liteMode}
      />

      <main className={`workspace-main ${liteMode ? 'workspace-lite' : 'workspace-3d'}`}>
        <EventSidebarList
          events={events}
          selectedEvent={selectedEvent}
          onSelectEvent={handleSelectEvent}
          isLoading={isLoadingEvents}
          liteMode={liteMode}
        />

        {!liteMode && (
          <section className="globe-viewport-panel" aria-label="3D Virtual Globe View">
            <GlobeCanvas
              events={events}
              selectedEvent={selectedEvent}
              onSelectEvent={handleSelectEvent}
              onViewportBboxChange={handleViewportBboxChange}
              useBboxFilter={filters.useBbox}
            />
          </section>
        )}

        <EventDetailDrawer
          event={selectedEvent}
          articles={articles}
          isLoadingArticles={isLoadingArticles}
          onClose={() => setSelectedEvent(null)}
        />
      </main>

      {/* Persistent Use-Boundary & Mandatory Uncertainty Disclaimers Footer */}
      <footer
        className="uncertainty-footer"
        role="contentinfo"
        data-testid="persistent-uncertainty-footer"
      >
        <div className="footer-boundary-pill">
          <strong>EDUCATIONAL &amp; INFORMATIONAL USE BOUNDARY:</strong> Not an emergency alerting,
          disaster prediction, casualty estimation, or evacuation routing service.
        </div>
        <div className="footer-caveats-row">
          <span data-testid="footer-caveat-geometry">
            <strong>1. Satellite Geometry Caveat:</strong> NASA EONET v3 coordinates/perimeters are
            approximate satellite observations with potential reporting delays.
          </span>
          <span className="footer-sep">·</span>
          <span data-testid="footer-caveat-density">
            <strong>2. National Population Density Caveat:</strong> REST Countries v3.1 density is a
            national macro-level average (Population ÷ Land Area in km²), not local disaster-zone
            exposure.
          </span>
          <span className="footer-sep">·</span>
          <span data-testid="footer-caveat-news">
            <strong>3. Contextual News Matching Caveat:</strong> NewsAPI v2 articles are matched by
            keywords, country names, and dates—not verified GPS coordinates.
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;
